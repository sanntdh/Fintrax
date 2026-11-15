"""API del hackathon. NEWS2 es del RCP y no está validado en vuelo."""
import asyncio
from contextlib import asynccontextmanager, suppress
from datetime import date, datetime
import logging
import math
import os
import re
import secrets

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import func, inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.db import (Alerta, AlertaEvento, Astronauta, Auditoria, Base, Evaluacion, LineaBaseDB,
                    Medicion, ReglasVersion, Usuario, crear_engine)
from app.legacy_api import crear_app  # Compatibilidad de la fábrica OIDC anterior.
from app.schemas import AstronautaIn, AstronautaPatch, MedicionIn, ReglasIn, ResolverIn, UsuarioIn
from app.seguridad import auditar, comprobar_acceso, get_db, hash_clave, requiere
from app import servicios as svc
from parametros import Reglas


def fila(objeto):
    datos = {c.name: getattr(objeto, c.name) for c in objeto.__table__.columns}
    if isinstance(objeto, LineaBaseDB):
        datos["desactualizada"] = objeto.desactualizada
    return datos


def publico(datos, usuario):
    """Minimiza todos los caminos de salida del rol tierra, incluidos snapshots."""
    datos = jsonable_encoder(datos)
    if usuario.rol != "tierra":
        return datos
    sensibles = {"entrada", "ciclo", "fase", "fase_ciclo", "ultima_menstruacion", "duracion_ciclo"}
    patron = re.compile(r"cicl|fase|menstr|l[uú]te|folicul|ovul", re.IGNORECASE)

    def limpiar(valor):
        if isinstance(valor, dict):
            salida = {}
            for k, v in valor.items():
                if k in sensibles:
                    continue
                if k in ("nota", "mensaje", "detalle") and isinstance(v, str) and patron.search(v):
                    v = "Información clínica restringida"
                if k in ("notas", "avisos") and isinstance(v, list):
                    v = [t for t in v if not isinstance(t, str) or not patron.search(t)]
                salida[k] = limpiar(v)
            return salida
        if isinstance(valor, list):
            return [limpiar(v) for v in valor]
        return valor
    return limpiar(datos)


def create_app(database_url=None, revision_minutos=None):
    engine = crear_engine(database_url or os.getenv("MONITOREO_DB", "sqlite:///monitoreo.db"))
    sesiones = sessionmaker(engine, expire_on_commit=False)
    revision = float(os.getenv("MONITOREO_REVISION_MIN", "0")) if revision_minutos is None else revision_minutos
    if isinstance(revision, bool) or not isinstance(revision, (int, float)) or not math.isfinite(revision) or revision < 0:
        raise ValueError("MONITOREO_REVISION_MIN debe ser finito y no negativo")

    async def vigilar():
        while True:
            await asyncio.sleep(revision * 60)
            try:
                with sesiones() as db:
                    svc.revisar_sin_medicion(db)
                    db.commit()
            except Exception:
                logging.getLogger(__name__).error("Falló la revisión periódica de mediciones")

    @asynccontextmanager
    async def lifespan(_):
        existentes = inspect(engine).get_table_names()
        if "medicion" in existentes and "contexto" not in {c["name"] for c in inspect(engine).get_columns("medicion")}:
            raise RuntimeError("La base pertenece al esquema anterior; use otra MONITOREO_DB, no se migrará automáticamente")
        Base.metadata.create_all(engine)
        with sesiones() as db:
            svc.reglas_activas(db)
            clave = os.getenv("MONITOREO_ADMIN_KEY")
            if clave and not db.scalar(select(func.count()).select_from(Usuario)):
                db.add(Usuario(nombre="Administrador", rol="admin", clave_hash=hash_clave(clave)))
            db.commit()
        tarea = asyncio.create_task(vigilar()) if revision else None
        try:
            yield
        finally:
            if tarea:
                tarea.cancel()
                with suppress(asyncio.CancelledError):
                    await tarea
            engine.dispose()

    app = FastAPI(title="Monitoreo de salud de astronautas", version="3.0.0", lifespan=lifespan)
    app.state.engine, app.state.SessionLocal = engine, sesiones

    @app.middleware("http")
    async def sin_cache(request, call_next):
        respuesta = await call_next(request)
        respuesta.headers["Cache-Control"] = "no-store"
        return respuesta

    @app.exception_handler(svc.ErrorNegocio)
    async def negocio(_, exc):
        return JSONResponse(status_code=exc.status, content={"detail": exc.detalle})

    @app.exception_handler(ValueError)
    async def dominio(_, exc):
        return JSONResponse(status_code=422, content={"detail": str(exc)})

    @app.exception_handler(RequestValidationError)
    async def entrada(_, exc):
        return JSONResponse(status_code=422, content={"detail": [
            {"loc": e["loc"], "msg": e["msg"], "type": e["type"]} for e in exc.errors()]})

    @app.exception_handler(IntegrityError)
    async def integridad(_, __):
        return JSONResponse(status_code=409, content={"detail": "Registro duplicado o referencia inválida"})

    def astro_autorizado(db, usuario, id, permiso="leer"):
        comprobar_acceso(db, usuario, id, permiso)
        a = svc.obtener_astronauta(db, id)
        auditar(db, usuario, permiso, "astronauta", id)
        db.commit()
        return a

    def negar(db, u, recurso):
        auditar(db, u, "acceso", recurso, exito=False)
        db.commit()
        raise HTTPException(403, "Acceso no autorizado")

    @app.get("/salud")
    def salud():
        return {"estado": "ok", "aviso": "Prototipo: reglas [CALIBRAR]; NEWS2 RCP no validado en vuelo"}

    @app.post("/usuarios", status_code=201)
    def crear_usuario(datos: UsuarioIn, db: Session = Depends(get_db), u=Depends(requiere("usuarios"))):
        if datos.astronauta_id is not None:
            svc.obtener_astronauta(db, datos.astronauta_id)
        clave = datos.clave or secrets.token_urlsafe(32)
        usuario = Usuario(**datos.model_dump(exclude={"clave"}), clave_hash=hash_clave(clave))
        db.add(usuario)
        db.commit()
        return {"id": usuario.id, "nombre": usuario.nombre, "rol": usuario.rol, "clave_api": clave}

    @app.post("/astronautas", status_code=201)
    def crear_astronauta(datos: AstronautaIn, db: Session = Depends(get_db), u=Depends(requiere("editar"))):
        if u.rol not in ("admin", "medico"):
            negar(db, u, "crear_astronauta")
        a = Astronauta(**datos.model_dump())
        db.add(a)
        db.flush()
        auditar(db, u, "crear", "astronauta", a.id)
        db.commit()
        return publico(fila(a), u)

    @app.get("/astronautas")
    def listar_astronautas(db: Session = Depends(get_db), u=Depends(requiere("leer")), limite: int = Query(100, ge=1, le=200)):
        q = select(Astronauta).where(Astronauta.activo.is_(True)).order_by(Astronauta.id).limit(limite)
        if u.rol == "astronauta":
            q = q.where(Astronauta.id == u.astronauta_id)
        return publico([fila(a) for a in db.scalars(q)], u)

    @app.get("/astronautas/{id}")
    def ver_astronauta(id: int, db: Session = Depends(get_db), u=Depends(requiere("leer"))):
        return publico(fila(astro_autorizado(db, u, id)), u)

    @app.patch("/astronautas/{id}")
    def editar_astronauta(id: int, datos: AstronautaPatch, db: Session = Depends(get_db), u=Depends(requiere("editar"))):
        a = astro_autorizado(db, u, id, "editar")
        cambios = datos.model_dump(exclude_unset=True)
        if u.rol == "astronauta" and set(cambios) - {"masa_kg", "ultima_menstruacion"}:
            negar(db, u, "editar_campos_clinicos")
        actual = fila(a)
        permitidos = set(AstronautaIn.model_fields)
        validados = AstronautaIn.model_validate({k: v for k, v in {**actual, **cambios}.items() if k in permitidos})
        for k, v in validados.model_dump().items():
            setattr(a, k, v)
        db.commit()
        return publico(fila(a), u)

    @app.post("/astronautas/{id}/mediciones", status_code=201)
    def registrar(id: int, datos: MedicionIn, db: Session = Depends(get_db), u=Depends(requiere("registrar"))):
        a = astro_autorizado(db, u, id, "registrar")
        try:
            salida = svc.registrar_medicion(db, a, datos, u)
            db.commit()
        except Exception:
            db.rollback()
            raise
        return publico({k: fila(v) if v is not None else None for k, v in salida.items()}, u)

    @app.post("/astronautas/{id}/linea-base")
    def calcular_base(id: int, db: Session = Depends(get_db), u=Depends(requiere("base"))):
        a = astro_autorizado(db, u, id, "base")
        bases = svc.calcular_linea_base(db, a)
        db.commit()
        return publico([fila(b) for b in bases], u)

    @app.get("/astronautas/{id}/linea-base")
    def ver_base(id: int, db: Session = Depends(get_db), u=Depends(requiere("leer"))):
        astro_autorizado(db, u, id)
        return publico([fila(b) for b in db.scalars(select(LineaBaseDB).where(LineaBaseDB.astronauta_id == id).order_by(LineaBaseDB.id))], u)

    @app.get("/astronautas/{id}/historial")
    def historial(id: int, db: Session = Depends(get_db), u=Depends(requiere("leer")), limite: int = Query(100, ge=1, le=200)):
        astro_autorizado(db, u, id)
        return publico([fila(e) for e in db.scalars(select(Evaluacion).where(Evaluacion.astronauta_id == id)
                                .order_by(Evaluacion.ts.desc(), Evaluacion.id.desc()).limit(limite))], u)

    @app.get("/astronautas/{id}/resumen")
    def resumen(id: int, db: Session = Depends(get_db), u=Depends(requiere("leer"))):
        return publico(svc.resumen_astronauta(db, astro_autorizado(db, u, id)), u)

    def ver_eval(db, u, id):
        e = db.get(Evaluacion, id)
        if e is None:
            raise svc.ErrorNegocio(404, "Evaluación no disponible")
        astro_autorizado(db, u, e.astronauta_id)
        return e

    @app.get("/evaluaciones/{id}")
    def evaluacion(id: int, db: Session = Depends(get_db), u=Depends(requiere("leer"))):
        return publico(fila(ver_eval(db, u, id)), u)

    @app.post("/evaluaciones/{id}/reproducir")
    def reproducir(id: int, db: Session = Depends(get_db), u=Depends(requiere("leer"))):
        return publico(svc.reproducir_evaluacion(db, ver_eval(db, u, id)), u)

    @app.post("/alertas/revisar-sin-medicion")
    def revisar(db: Session = Depends(get_db), u=Depends(requiere("resolver"))):
        alertas = svc.revisar_sin_medicion(db)
        db.commit()
        return publico([fila(a) for a in alertas], u)

    @app.get("/alertas")
    def alertas(db: Session = Depends(get_db), u=Depends(requiere("leer")), limite: int = Query(100, ge=1, le=200)):
        q = select(Alerta).order_by(Alerta.creada.desc(), Alerta.id.desc()).limit(limite)
        if u.rol == "astronauta":
            q = q.where(Alerta.astronauta_id == u.astronauta_id)
        return publico([fila(a) for a in db.scalars(q)], u)

    def ver_alerta(db, u, id, permiso="leer"):
        a = db.get(Alerta, id)
        if a is None:
            raise svc.ErrorNegocio(404, "Alerta no disponible")
        astro_autorizado(db, u, a.astronauta_id, permiso)
        return a

    @app.get("/alertas/{id}")
    def alerta(id: int, db: Session = Depends(get_db), u=Depends(requiere("leer"))):
        a = ver_alerta(db, u, id)
        eventos = list(db.scalars(select(AlertaEvento).where(AlertaEvento.alerta_id == id).order_by(AlertaEvento.id)))
        return publico({**fila(a), "eventos": [fila(e) for e in eventos]}, u)

    @app.post("/alertas/{id}/reconocer")
    def reconocer(id: int, db: Session = Depends(get_db), u=Depends(requiere("reconocer"))):
        a = svc.cambiar_alerta(db, ver_alerta(db, u, id, "reconocer"), "reconocer", u)
        db.commit()
        return publico(fila(a), u)

    @app.post("/alertas/{id}/resolver")
    def resolver(id: int, datos: ResolverIn, db: Session = Depends(get_db), u=Depends(requiere("resolver"))):
        a = svc.cambiar_alerta(db, ver_alerta(db, u, id, "resolver"), "resolver", u, datos.nota)
        db.commit()
        return publico(fila(a), u)

    @app.get("/reglas")
    def reglas(db: Session = Depends(get_db), u=Depends(requiere("leer"))):
        return fila(svc.reglas_activas(db))

    @app.get("/reglas/versiones")
    def versiones(db: Session = Depends(get_db), u=Depends(requiere("leer"))):
        return [fila(v) for v in db.scalars(select(ReglasVersion).order_by(ReglasVersion.id))]

    @app.put("/reglas")
    def actualizar_reglas(datos: ReglasIn, db: Session = Depends(get_db), u=Depends(requiere("reglas"))):
        version = svc.crear_version_reglas(db, datos.model_dump(exclude_unset=True, exclude={"motivo"}), u.id, datos.motivo)
        db.commit()
        return fila(version)

    @app.get("/auditoria")
    def auditoria(db: Session = Depends(get_db), u=Depends(requiere("auditoria")), limite: int = Query(100, ge=1, le=200)):
        return [fila(a) for a in db.scalars(select(Auditoria).order_by(Auditoria.id.desc()).limit(limite))]

    return app


app = create_app()
