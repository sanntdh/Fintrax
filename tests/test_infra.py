"""Pruebas de infraestructura: ORM SQLite (S5) y seguridad por X-API-Key (S9)."""

import hashlib
from datetime import datetime, timezone

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.db import (
    Alerta,
    AlertaEvento,
    Astronauta,
    Auditoria,
    Base,
    Evaluacion,
    LineaBaseDB,
    Medicion,
    ReglasVersion,
    Usuario,
    ahora,
    crear_engine,
)
from app.seguridad import (
    auditar,
    comprobar_acceso,
    get_db,
    hash_clave,
    obtener_usuario,
    requiere,
)


@pytest.fixture
def motor():
    engine = crear_engine("sqlite://")
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def sesiones(motor):
    return sessionmaker(motor, expire_on_commit=False)


@pytest.fixture
def semilla(sesiones):
    with sesiones() as sesion:
        ana = Astronauta(nombre="Ana", sexo="F", estatura_m=1.65, masa_kg=60.0, edad=30,
                         ciclo="regular", duracion_ciclo=28, en_mision=False, activo=True)
        luis = Astronauta(nombre="Luis", sexo="M", estatura_m=1.80, masa_kg=80.0, edad=35,
                          ciclo="no_aplica", duracion_ciclo=28, en_mision=False, activo=True)
        sesion.add_all([ana, luis])
        sesion.flush()
        sesion.add_all([
            Usuario(nombre="Admin", rol="admin", clave_hash=hash_clave("k-admin"), activo=True),
            Usuario(nombre="Medico", rol="medico", clave_hash=hash_clave("k-medico"), activo=True),
            Usuario(nombre="Tierra", rol="tierra", clave_hash=hash_clave("k-tierra"), activo=True),
            Usuario(nombre="Ana", rol="astronauta", astronauta_id=ana.id,
                    clave_hash=hash_clave("k-ana"), activo=True),
            Usuario(nombre="Luis", rol="astronauta", astronauta_id=luis.id,
                    clave_hash=hash_clave("k-luis"), activo=True),
            Usuario(nombre="Inactivo", rol="medico", clave_hash=hash_clave("k-inactivo"), activo=False),
        ])
        sesion.commit()
        datos = {
            "astro_ana": ana.id,
            "astro_luis": luis.id,
            "claves": {
                "admin": "k-admin",
                "medico": "k-medico",
                "tierra": "k-tierra",
                "astronauta": "k-ana",
                "inactivo": "k-inactivo",
            },
        }
    return datos


COLUMNAS = {
    Usuario: ["id", "nombre", "rol", "astronauta_id", "clave_hash", "activo", "creado"],
    Astronauta: ["id", "nombre", "sexo", "estatura_m", "masa_kg", "edad", "ciclo",
                 "ultima_menstruacion", "duracion_ciclo", "en_mision", "activo", "creado"],
    Medicion: ["id", "astronauta_id", "ts", "contexto", "fr", "spo2", "pas", "fc", "temp",
               "conciencia", "oxigeno_suplementario", "hipercapnico", "co2_mmhg", "ejercicio",
               "fase_ciclo", "masa_kg", "complementarios", "creado_por"],
    LineaBaseDB: ["id", "astronauta_id", "fase_ciclo", "fc", "pas", "fr", "temp", "spo2",
                  "n_muestras", "masa_kg", "activa", "creada"],
    ReglasVersion: ["id", "creada", "creado_por", "motivo", "contenido"],
    Evaluacion: ["id", "medicion_id", "astronauta_id", "ts", "nivel", "news2_total",
                 "resultado", "version_reglas", "entrada"],
    Alerta: ["id", "astronauta_id", "evaluacion_id", "tipo", "nivel", "mensaje", "estado",
             "destinatarios", "ocurrencias", "creada", "ultima_ts"],
    AlertaEvento: ["id", "alerta_id", "ts", "actor", "rol", "accion", "nota"],
    Auditoria: ["id", "ts", "usuario_id", "actor", "rol", "accion", "recurso",
                "astronauta_id", "detalle", "exito"],
}


@pytest.mark.parametrize("modelo,columnas", list(COLUMNAS.items()),
                         ids=[modelo.__name__ for modelo in COLUMNAS])
def test_tablas_y_campos_exactos(modelo, columnas):
    assert list(modelo.__table__.columns.keys()) == columnas


def test_indices_y_unicos_declarados():
    assert Medicion.__table__.c.astronauta_id.index is True
    assert Medicion.__table__.c.ts.index is True
    assert Usuario.__table__.c.clave_hash.unique is True
    assert Evaluacion.__table__.c.medicion_id.unique is True


def test_ahora_es_utc_naive():
    momento = ahora()
    assert momento.tzinfo is None
    referencia = datetime.now(timezone.utc).replace(tzinfo=None)
    assert abs((referencia - momento).total_seconds()) < 5


def test_memoria_se_comparte_entre_sesiones():
    engine = crear_engine("sqlite://")
    Base.metadata.create_all(engine)
    Sesion = sessionmaker(engine, expire_on_commit=False)
    with Sesion() as sesion:
        sesion.add(Usuario(nombre="Persistente", rol="admin",
                           clave_hash=hash_clave("k-persistente"), activo=True))
        sesion.commit()
    with Sesion() as sesion:
        assert sesion.scalar(select(func.count(Usuario.id))) == 1
    engine.dispose()


def test_defaults_explicitos_de_astronauta(sesiones):
    with sesiones() as sesion:
        astronauta = Astronauta(nombre="Nuevo", sexo="M", estatura_m=1.75, masa_kg=75.0,
                               edad=40, ciclo="no_aplica")
        sesion.add(astronauta)
        sesion.commit()
        assert astronauta.en_mision is False
        assert astronauta.duracion_ciclo == 28


def test_ts_y_creado_son_naive(sesiones, semilla):
    with sesiones() as sesion:
        medicion = Medicion(astronauta_id=semilla["astro_ana"], contexto="preflight",
                            fr=12, spo2=98, pas=120, fc=70, temp=36.5, conciencia="alerta")
        sesion.add(medicion)
        sesion.commit()
        assert medicion.ts.tzinfo is None
        assert medicion.creado_por is None
        assert medicion.complementarios is None


def test_sqlite_aplica_claves_foraneas(sesiones):
    with sesiones() as sesion:
        sesion.add(Medicion(astronauta_id=999999, contexto="preflight", fr=12, spo2=98,
                            pas=120, fc=70, temp=36.5, conciencia="alerta"))
        with pytest.raises(IntegrityError):
            sesion.commit()
        sesion.rollback()


def test_clave_hash_es_unica(sesiones, semilla):
    with sesiones() as sesion:
        sesion.add(Usuario(nombre="Duplicado", rol="admin",
                           clave_hash=hash_clave("k-admin"), activo=True))
        with pytest.raises(IntegrityError):
            sesion.commit()
        sesion.rollback()


def test_evaluacion_medicion_es_unica(sesiones, semilla):
    with sesiones() as sesion:
        medicion = Medicion(astronauta_id=semilla["astro_ana"], contexto="mision",
                            fr=14, spo2=97, pas=118, fc=80, temp=36.6, conciencia="alerta")
        sesion.add(medicion)
        sesion.flush()
        reglas = ReglasVersion(motivo="inicial", contenido={"desv": {}})
        sesion.add(reglas)
        sesion.flush()
        sesion.add(Evaluacion(medicion_id=medicion.id, astronauta_id=semilla["astro_ana"],
                              nivel=1, news2_total=2, resultado={"capa": "normal"},
                              version_reglas=reglas.id, entrada={"fc": 80}))
        sesion.commit()

    with sesiones() as sesion:
        medicion_id = sesion.scalar(select(Medicion.id))
        reglas_id = sesion.scalar(select(ReglasVersion.id))
        sesion.add(Evaluacion(medicion_id=medicion_id, astronauta_id=semilla["astro_ana"],
                              nivel=1, news2_total=2, resultado={},
                              version_reglas=reglas_id, entrada={}))
        with pytest.raises(IntegrityError):
            sesion.commit()
        sesion.rollback()


def test_json_medicion_y_reglas_ida_y_vuelta(sesiones, semilla):
    with sesiones() as sesion:
        medicion = Medicion(astronauta_id=semilla["astro_ana"], contexto="preflight",
                            fr=12, spo2=98, pas=120, fc=70, temp=36.5, conciencia="alerta",
                            complementarios={"sintomas": ["mareo"], "n": 1})
        reglas = ReglasVersion(motivo="prueba", contenido={"desv": {"fc": 2}, "ok": True})
        sesion.add_all([medicion, reglas])
        sesion.commit()
        medicion_id, reglas_id = medicion.id, reglas.id

    with sesiones() as sesion:
        assert sesion.get(Medicion, medicion_id).complementarios == {"sintomas": ["mareo"], "n": 1}
        assert sesion.get(ReglasVersion, reglas_id).contenido == {"desv": {"fc": 2}, "ok": True}


def test_json_evaluacion_y_alerta_ida_y_vuelta(sesiones, semilla):
    with sesiones() as sesion:
        medicion = Medicion(astronauta_id=semilla["astro_ana"], contexto="mision",
                            fr=14, spo2=97, pas=118, fc=80, temp=36.6, conciencia="alerta")
        sesion.add(medicion)
        sesion.flush()
        reglas = ReglasVersion(motivo="inicial", contenido={"v": 1})
        sesion.add(reglas)
        sesion.flush()
        evaluacion = Evaluacion(medicion_id=medicion.id, astronauta_id=semilla["astro_ana"],
                                nivel=2, news2_total=4, resultado={"capas": ["news2"]},
                                version_reglas=reglas.id, entrada={"fc": 80, "spo2": 97})
        sesion.add(evaluacion)
        sesion.flush()
        alerta = Alerta(astronauta_id=semilla["astro_ana"], evaluacion_id=evaluacion.id,
                        tipo="news2", nivel="MEDIO", mensaje="alerta", estado="nueva",
                        destinatarios=["medico"])
        sesion.add(alerta)
        sesion.commit()
        ev_id, al_id = evaluacion.id, alerta.id

    with sesiones() as sesion:
        ev = sesion.get(Evaluacion, ev_id)
        assert ev.resultado == {"capas": ["news2"]}
        assert ev.entrada == {"fc": 80, "spo2": 97}
        assert sesion.get(Alerta, al_id).destinatarios == ["medico"]


def test_auditoria_permite_astronauta_inexistente(sesiones):
    with sesiones() as sesion:
        sesion.add(Auditoria(actor="Sistema", rol="tierra", accion="prueba",
                             recurso="astronauta", astronauta_id=999999))
        sesion.commit()
        assert sesion.scalar(select(func.count(Auditoria.id))) == 1


def _ruta_permiso(permiso):
    def endpoint(usuario=Depends(requiere(permiso))):
        return {"permiso": permiso, "usuario": usuario.nombre}

    return endpoint


PERMISOS = ["leer", "registrar", "editar", "base", "reconocer", "resolver",
            "usuarios", "reglas", "auditoria"]


def crear_app_prueba(sesiones):
    app = FastAPI()
    app.state.SessionLocal = sesiones
    for permiso in PERMISOS:
        app.add_api_route(f"/{permiso}", _ruta_permiso(permiso), methods=["GET"],
                          name=f"permiso_{permiso}")

    @app.get("/quien")
    def quien(usuario=Depends(obtener_usuario)):
        return {"nombre": usuario.nombre, "rol": usuario.rol}

    @app.get("/astro/{astronauta_id}")
    def astro(astronauta_id: int, db=Depends(get_db), usuario=Depends(obtener_usuario)):
        comprobar_acceso(db, usuario, astronauta_id)
        return {"ok": True}

    @app.get("/astro/{astronauta_id}/registrar")
    def astro_registrar(astronauta_id: int, db=Depends(get_db), usuario=Depends(obtener_usuario)):
        comprobar_acceso(db, usuario, astronauta_id, permiso="registrar")
        return {"ok": True}

    @app.get("/astro/{astronauta_id}/resolver")
    def astro_resolver(astronauta_id: int, db=Depends(get_db), usuario=Depends(obtener_usuario)):
        comprobar_acceso(db, usuario, astronauta_id, permiso="resolver")
        return {"ok": True}

    @app.get("/sin-commit")
    def sin_commit(db=Depends(get_db)):
        db.add(Astronauta(nombre="Temporal", sexo="M", estatura_m=1.70, masa_kg=70.0,
                         edad=30, ciclo="no_aplica"))
        return {"ok": True}

    return app


@pytest.fixture
def cliente(sesiones):
    with TestClient(crear_app_prueba(sesiones)) as test_client:
        yield test_client


def test_hash_clave_es_sha256_y_no_claro():
    esperado = hashlib.sha256("secreto".encode("utf-8")).hexdigest()
    assert hash_clave("secreto") == esperado
    assert hash_clave("secreto") != "secreto"
    assert len(esperado) == 64


def test_clave_se_almacena_solo_como_hash(sesiones, semilla):
    with sesiones() as sesion:
        almacenada = sesion.scalar(select(Usuario.clave_hash).where(Usuario.nombre == "Ana"))
    assert almacenada == hashlib.sha256(b"k-ana").hexdigest()
    assert almacenada != "k-ana"


def test_api_key_ausente_invalida_o_inactiva_401(cliente):
    assert cliente.get("/quien").status_code == 401
    assert cliente.get("/quien", headers={"X-API-Key": "k-no-existe"}).status_code == 401
    assert cliente.get("/quien", headers={"X-API-Key": "k-inactivo"}).status_code == 401


def test_api_key_valida_devuelve_usuario_sin_hash(cliente, semilla):
    respuesta = cliente.get("/quien", headers={"X-API-Key": "k-ana"})
    assert respuesta.status_code == 200
    assert respuesta.json() == {"nombre": "Ana", "rol": "astronauta"}
    assert "clave_hash" not in respuesta.text
    assert "k-ana" not in respuesta.text


ESPERADO = {
    "admin": set(PERMISOS),
    "medico": {"leer", "registrar", "editar", "base", "reconocer", "resolver"},
    "tierra": {"leer", "reconocer"},
    "astronauta": {"leer", "registrar", "editar", "reconocer"},
}


@pytest.mark.parametrize("rol", list(ESPERADO))
def test_matriz_permisos_por_rol(cliente, semilla, rol):
    clave = semilla["claves"][rol]
    for permiso in PERMISOS:
        respuesta = cliente.get(f"/{permiso}", headers={"X-API-Key": clave})
        esperado = 200 if permiso in ESPERADO[rol] else 403
        assert respuesta.status_code == esperado, (rol, permiso, respuesta.status_code, respuesta.text)


def test_permiso_desconocido_es_error_de_programacion():
    with pytest.raises(ValueError):
        requiere("permiso-inexistente")


def test_requiere_audita_permitidos_y_denegados(cliente, sesiones, semilla):
    assert cliente.get("/leer", headers={"X-API-Key": "k-tierra"}).status_code == 200
    assert cliente.get("/resolver", headers={"X-API-Key": "k-tierra"}).status_code == 403

    with sesiones() as sesion:
        filas = list(sesion.scalars(select(Auditoria).order_by(Auditoria.id)))

    assert any(fila.exito and fila.recurso == "leer" for fila in filas)
    assert any((not fila.exito) and fila.recurso == "resolver" for fila in filas)
    for fila in filas:
        assert fila.actor == "Tierra"
        assert fila.rol == "tierra"
        assert fila.usuario_id is not None
        assert "k-tierra" not in (fila.detalle or "")
        assert "k-tierra" not in (fila.recurso or "")


def test_auditar_no_confirma_por_si_solo(sesiones):
    with sesiones() as sesion:
        usuario = sesion.scalar(select(Usuario).where(Usuario.nombre == "Admin"))
        auditar(sesion, usuario, "prueba", "recurso")
        sesion.rollback()

    with sesiones() as sesion:
        assert sesion.scalar(select(func.count(Auditoria.id))) == 0


def test_get_db_no_confirma_mutaciones(cliente, semilla, sesiones):
    assert cliente.get("/sin-commit").status_code == 200
    with sesiones() as sesion:
        assert sesion.scalar(select(func.count(Astronauta.id))) == 2


def test_astronauta_solo_accede_a_su_registro(cliente, semilla, sesiones):
    ana = semilla["astro_ana"]
    luis = semilla["astro_luis"]
    assert cliente.get(f"/astro/{ana}", headers={"X-API-Key": "k-ana"}).status_code == 200
    assert cliente.get(f"/astro/{luis}", headers={"X-API-Key": "k-ana"}).status_code == 403

    with sesiones() as sesion:
        denegadas = list(sesion.scalars(select(Auditoria).where(Auditoria.exito.is_(False))))
    assert any(fila.astronauta_id == luis and fila.accion == "acceso" for fila in denegadas)


def test_medico_admin_y_tierra_tienen_alcance_global(cliente, semilla):
    luis = semilla["astro_luis"]
    for clave in ("k-medico", "k-admin", "k-tierra"):
        respuesta = cliente.get(f"/astro/{luis}", headers={"X-API-Key": clave})
        assert respuesta.status_code == 200, (clave, respuesta.text)


def test_tierra_no_registra_ni_resuelve(cliente, semilla):
    ana = semilla["astro_ana"]
    assert cliente.get(f"/astro/{ana}/registrar", headers={"X-API-Key": "k-tierra"}).status_code == 403
    assert cliente.get(f"/astro/{ana}/resolver", headers={"X-API-Key": "k-tierra"}).status_code == 403


def test_astronauta_no_resuelve_y_medico_si(cliente, semilla):
    ana = semilla["astro_ana"]
    assert cliente.get(f"/astro/{ana}/resolver", headers={"X-API-Key": "k-ana"}).status_code == 403
    assert cliente.get(f"/astro/{ana}/resolver", headers={"X-API-Key": "k-medico"}).status_code == 200


@pytest.mark.parametrize("url", [
    "postgresql://fintrax:clave@db.ejemplo.com/fintrax?sslmode=require",
    "postgres://fintrax:clave@db.ejemplo.com/fintrax",
])
def test_url_postgres_de_proveedor_usa_psycopg(url):
    # Neon, Render o Railway dan la URL sin driver; el backend solo instala psycopg 3.
    from app.db import crear_engine
    motor = crear_engine(url)
    assert motor.dialect.driver == "psycopg"
    assert motor.url.query.get("sslmode") == ("require" if "sslmode" in url else None)


def test_url_con_driver_o_sqlite_no_cambia():
    from app.db import crear_engine
    assert crear_engine("postgresql+psycopg://u:c@h/db").dialect.driver == "psycopg"
    assert crear_engine("sqlite:///:memory:").dialect.name == "sqlite"


def test_postgres_comprueba_la_conexion_antes_de_usarla():
    # Neon suspende el cómputo sin uso y cierra las conexiones del pool; sin
    # comprobación previa, la primera petición tras despertar devuelve un 500.
    from app.db import crear_engine
    assert crear_engine("postgresql://u:c@h/db").pool._pre_ping is True
