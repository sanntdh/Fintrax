from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from cryptography.fernet import InvalidToken
from fastapi import Depends, FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.exc import SQLAlchemyError

from app.almacen import Almacen, ErrorServicio
from app.clinica import Clinica
from app.config import Configuracion
from app.esquemas import (AlertasSalida, CrearAstronauta, EvaluacionEntrada, EvaluacionSalida,
                           HistorialSalida, IdSalida, PerfilEntrada, ReproduccionSalida, TransicionAlerta)
from app.seguridad import IdentidadInvalida, VerificadorOIDC
from reglas import cargar_reglas


def crear_app(configuracion=None, *, verificador=None, reloj=None):
    config = configuracion or Configuracion.entorno()
    if (verificador is not None or reloj is not None) and not config.pruebas:
        raise ValueError("sustituciones de identidad/reloj solo permitidas en pruebas")
    verificar = verificador if verificador is not None else VerificadorOIDC(config)
    reloj = reloj or (lambda: datetime.now(timezone.utc))
    db = Almacen(config.database_url, config.clave_cifrado, config.oidc_emisor)
    clinica = Clinica(db, cargar_reglas(config.reglas_ruta))

    @asynccontextmanager
    async def lifespan(_):
        db.comprobar_esquema()
        yield
        db.engine.dispose()

    app = FastAPI(title="Astronaut Health Monitoring", version="2.0.0", lifespan=lifespan,
                  docs_url="/docs" if config.pruebas else None,
                  redoc_url=None, openapi_url="/openapi.json" if config.pruebas else None)
    app.state.almacen = db
    bearer = HTTPBearer(auto_error=False)

    @app.middleware("http")
    async def privacidad(request, call_next):
        respuesta = await call_next(request)
        respuesta.headers["Cache-Control"] = "no-store"
        respuesta.headers["Pragma"] = "no-cache"
        respuesta.headers["X-Content-Type-Options"] = "nosniff"
        return respuesta

    @app.exception_handler(ErrorServicio)
    async def error_servicio(_, exc):
        headers = {"WWW-Authenticate": "Bearer"} if exc.estado == 401 else None
        return JSONResponse(status_code=exc.estado, content={"detail": exc.mensaje}, headers=headers)

    @app.exception_handler(RequestValidationError)
    async def error_entrada(request, exc):
        principal = getattr(request.state, "principal", None)
        db.registrar(principal.actor if principal else None, None, "validacion", "rechazado", reloj())
        errores = [{"loc": e["loc"], "type": e["type"], "msg": e["msg"]} for e in exc.errors()]
        return JSONResponse(status_code=422, content={"detail": errores})

    @app.exception_handler(SQLAlchemyError)
    async def error_base(_, __):
        return JSONResponse(status_code=503, content={"detail": "Persistencia no disponible; operacion no confirmada"})

    @app.exception_handler(InvalidToken)
    async def error_cifrado(_, __):
        return JSONResponse(status_code=503, content={"detail": "Datos no disponibles con la clave configurada"})

    def autenticar(request: Request, credencial: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
        try:
            if credencial is None or credencial.scheme.lower() != "bearer" or len(credencial.credentials) > 16384:
                raise IdentidadInvalida()
            subject = verificar(credencial.credentials)
            principal = db.principal(subject)
            if principal is None:
                raise IdentidadInvalida()
        except IdentidadInvalida as exc:
            db.registrar(None, None, "autenticacion", "denegado", reloj())
            raise ErrorServicio(401, "Identidad no valida o no habilitada") from exc
        request.state.principal = principal
        return principal

    @app.post("/astronautas", response_model=IdSalida, status_code=201)
    def crear(datos: CrearAstronauta, principal=Depends(autenticar)):
        return clinica.crear(principal, datos.perfil.model_dump(mode="json"), reloj())

    @app.put("/astronautas/{id}/perfil", response_model=IdSalida)
    def actualizar(id: UUID, datos: PerfilEntrada, principal=Depends(autenticar)):
        return clinica.actualizar_perfil(principal, str(id), datos.model_dump(mode="json"), reloj())

    @app.post("/evaluaciones", response_model=EvaluacionSalida, status_code=201)
    def evaluar(datos: EvaluacionEntrada, principal=Depends(autenticar)):
        return clinica.evaluar(principal, datos, reloj())

    @app.get("/astronautas/{id}/historial", response_model=HistorialSalida)
    def historial(id: UUID, limite: Annotated[int, Query(ge=1, le=100)] = 50,
                  desplazamiento: Annotated[int, Query(ge=0, le=100000)] = 0,
                  principal=Depends(autenticar)):
        return clinica.historial(principal, str(id), reloj(), limite, desplazamiento)

    @app.get("/astronautas/{id}/alertas", response_model=AlertasSalida)
    def alertas(id: UUID, principal=Depends(autenticar)):
        return clinica.alertas(principal, str(id), reloj())

    @app.patch("/alertas/{id}", response_model=dict[str, str])
    def transicion(id: UUID, datos: TransicionAlerta, principal=Depends(autenticar)):
        return clinica.transicion(principal, str(id), datos.estado, reloj())

    @app.post("/astronautas/{id}/comprobar-ausencia", response_model=dict)
    def ausencia(id: UUID, principal=Depends(autenticar)):
        return clinica.comprobar_ausencia(principal, str(id), reloj())

    @app.post("/evaluaciones/{id}/reproducir", response_model=ReproduccionSalida)
    def reproducir(id: UUID, principal=Depends(autenticar)):
        return clinica.reproducir(principal, str(id), reloj())

    return app
