from datetime import timedelta
import os
from unittest.mock import patch

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import func, select

from app.db import Auditoria, Evaluacion, Medicion, ahora
from app.main import create_app


@pytest.fixture
def entorno():
    with patch.dict(os.environ, {"MONITOREO_ADMIN_KEY": "admin-pruebas-no-produccion"}):
        app = create_app("sqlite://", revision_minutos=0)
        with TestClient(app) as c:
            yield c, app, {"X-API-Key": "admin-pruebas-no-produccion"}


def astronauta(c, h, **extra):
    r = c.post("/astronautas", headers=h, json={"nombre": "Prueba", "sexo": "M",
        "estatura_m": 1.8, "masa_kg": 80, "edad": 40, **extra})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def lectura(c, h, a, contexto="preflight", dias=1, **extra):
    datos = {"ts": (ahora() - timedelta(days=dias)).isoformat(), "contexto": contexto,
             "signos": {"fr": 14, "spo2": 98, "pas": 115, "fc": 64, "temp": 36.6}, **extra}
    return c.post(f"/astronautas/{a}/mediciones", headers=h, json=datos)


def preparar(c, h, **extra):
    a = astronauta(c, h, **extra)
    for dia in range(8, 3, -1):
        r = lectura(c, h, a, dias=dia)
        assert r.status_code == 201, r.text
        assert r.json()["evaluacion"] is None
    r = c.post(f"/astronautas/{a}/linea-base", headers=h)
    assert r.status_code == 200, r.text
    return a


def usuario(c, h, rol, a=None):
    r = c.post("/usuarios", headers=h, json={"nombre": rol, "rol": rol, "astronauta_id": a})
    assert r.status_code == 201, r.text
    return {"X-API-Key": r.json()["clave_api"]}


def test_preflight_solo_persiste_y_flujo_alertas_reproduccion(entorno):
    c, app, h = entorno
    a = preparar(c, h)
    with app.state.SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Evaluacion)) == 0
        assert db.scalar(select(func.count()).select_from(Medicion)) == 5
    r = lectura(c, h, a, contexto="vuelo", dias=0, co2_mmhg=5.3)
    assert r.status_code == 201, r.text
    e = r.json()["evaluacion"]
    assert e["nivel"] == 2
    assert c.post(f'/evaluaciones/{e["id"]}/reproducir', headers=h).json()["coincide"]
    alertas = c.get("/alertas", headers=h).json()
    aid = alertas[0]["id"]
    assert c.post(f"/alertas/{aid}/reconocer", headers=h).status_code == 200
    assert c.post(f"/alertas/{aid}/resolver", headers=h, json={"nota": "Comprobación clínica demo"}).status_code == 200
    assert c.post(f"/alertas/{aid}/reconocer", headers=h).status_code == 409


def test_sin_base_evalua_y_entradas_invalidas_no_se_guardan(entorno):
    c, app, h = entorno
    a = astronauta(c, h)
    assert lectura(c, h, a, contexto="vuelo").status_code == 201
    assert lectura(c, h, a, complementarios={"cambio_visual": True}).status_code == 422
    assert lectura(c, h, a, signos={"fr": "NaN", "pas": -5, "spo2": 98, "fc": 64, "temp": 36.6}).status_code == 422
    with app.state.SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Medicion)) == 1
    r = c.post(f"/astronautas/{a}/linea-base", headers=h)
    assert r.status_code == 409
    assert "faltan" in r.text.lower()


@pytest.mark.parametrize("signos,extras,tipo,nivel", [
    ({"fc":135,"fr":26,"spo2":90,"pas":115,"temp":36.6,"conciencia":"confuso"}, {}, "news2", 2),
    ({"fc":64,"fr":14,"spo2":98,"pas":115,"temp":36.6}, {"co2_mmhg":5.5}, "co2", 2),
    ({"fc":64,"fr":14,"spo2":98,"pas":115,"temp":36.6}, {"complementarios":{"cambio_visual":True}}, "cribado:sans", 0),
])
def test_mision_sin_base_conserva_piso_y_reproduce(entorno, signos, extras, tipo, nivel):
    c, app, h = entorno
    a = astronauta(c, h)
    r = lectura(c, h, a, contexto="vuelo", dias=0, signos=signos, **extras)
    assert r.status_code == 201, r.text
    e = r.json()["evaluacion"]
    assert e["nivel"] == nivel
    assert e["entrada"]["base"] is None
    assert e["resultado"]["niveles_capas"]["desviacion"] == 0
    assert any("Sin linea base personal" in n for n in e["resultado"]["notas"])
    alertas = c.get("/alertas", headers=h).json()
    assert tipo in {aviso["tipo"] for aviso in alertas}
    aviso = next(aviso for aviso in alertas if aviso["tipo"] == "sin_linea_base")
    assert int(aviso["nivel"]) == 1 and aviso["destinatarios"] == ["medico"]
    repro = c.post(f'/evaluaciones/{e["id"]}/reproducir', headers=h)
    assert repro.status_code == 200 and repro.json()["coincide"]


def test_permisos_auditoria_y_tierra_oculta_ciclo(entorno):
    c, app, h = entorno
    a = preparar(c, h, sexo="F", ciclo="natural", ultima_menstruacion=(ahora().date() - timedelta(days=14)).isoformat())
    propio = usuario(c, h, "astronauta", a)
    otro = astronauta(c, h)
    assert c.get("/astronautas", headers={}).status_code == 401
    assert c.get(f"/astronautas/{otro}/historial", headers=propio).status_code == 403
    assert c.patch(f"/astronautas/{a}", headers=propio, json={"sexo": "M"}).status_code == 403
    assert c.patch(f"/astronautas/{a}", headers=propio, json={"masa_kg": 79}).status_code == 200
    tierra = usuario(c, h, "tierra")
    assert c.get("/auditoria", headers=tierra).status_code == 403
    r = c.get("/astronautas", headers=tierra)
    assert r.status_code == 200
    assert "ciclo" not in r.text and "ultima_menstruacion" not in r.text
    with app.state.SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Auditoria).where(Auditoria.exito.is_(False))) >= 3


def test_historico_no_sustituye_masa_actual_y_reglas_versionadas(entorno):
    c, app, h = entorno
    a = preparar(c, h)
    assert lectura(c, h, a, contexto="vuelo", dias=0, masa_kg=81).status_code == 201
    assert lectura(c, h, a, contexto="vuelo", dias=2, masa_kg=78).status_code == 201
    assert c.get(f"/astronautas/{a}", headers=h).json()["masa_kg"] == 81
    r = c.put("/reglas", headers=h, json={"persistencia_desviacion": 3, "motivo": "Prueba de calibración"})
    assert r.status_code == 200, r.text
    assert r.json()["id"] == 2
    assert c.put("/reglas", headers=h, json={"co2_alto": 1}).status_code == 422


@pytest.mark.parametrize("origen", ["lectura", "perfil"])
def test_masa_seis_por_ciento_no_desactiva_base(entorno, origen):
    c, app, h = entorno
    a = preparar(c, h)
    propia = usuario(c, h, "astronauta", a)
    inicial = c.get(f"/astronautas/{a}/linea-base", headers=propia).json()[-1]
    assert inicial["desactualizada"] is False
    if origen == "perfil":
        assert c.patch(f"/astronautas/{a}", headers=propia, json={"masa_kg":75.2}).status_code == 200
    else:
        assert lectura(c, propia, a, contexto="vuelo", dias=0, masa_kg=75.2).status_code == 201
    siguiente = lectura(c, propia, a, contexto="vuelo", dias=0)
    assert siguiente.status_code == 201, siguiente.text
    e = siguiente.json()["evaluacion"]
    assert e["entrada"]["base"] is not None
    assert any("80 kg" in n and "75.2 kg" in n and "recalcular" in n for n in e["resultado"]["notas"])
    bases = c.get(f"/astronautas/{a}/linea-base", headers=propia).json()
    assert bases[-1]["id"] == inicial["id"] and bases[-1]["activa"] is True
    assert bases[-1]["desactualizada"] is True
    assert c.get(f"/astronautas/{a}/resumen", headers=propia).json()["desactualizada"] is True
    assert c.post(f'/evaluaciones/{e["id"]}/reproducir', headers=h).json()["coincide"]
    with app.state.SessionLocal() as db:
        from app.db import LineaBaseDB
        assert "desactualizada" not in LineaBaseDB.__table__.columns
    assert c.post(f"/astronautas/{a}/linea-base", headers=propia).status_code == 403
    nuevas = c.post(f"/astronautas/{a}/linea-base", headers=h).json()
    assert nuevas[0]["id"] != inicial["id"] and nuevas[0]["desactualizada"] is False
