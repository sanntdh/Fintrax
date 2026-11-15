"""Destinatarios de alertas y minimización del rol tierra (T3/S3).

Cubre la política de destinatarios por tipo y nivel, el filtrado de listado,
detalle y reconocer con 403 auditados, la actualización de destinatarios en la
escalada sin perder ocurrencias ni eventos, y la minimización de cribado,
condiciones, evidencia, notas y datos de ciclo para el rol tierra.
"""
from datetime import timedelta
import os
from unittest.mock import patch

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import func, select

from app import servicios as svc
from app.db import Alerta, AlertaEvento, Auditoria, ahora
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


def usuario(c, h, rol, a=None):
    r = c.post("/usuarios", headers=h, json={"nombre": rol, "rol": rol, "astronauta_id": a})
    assert r.status_code == 201, r.text
    return {"X-API-Key": r.json()["clave_api"]}


def alerta_directa(app, astro_id, tipo, nivel="1", destinatarios=None, estado="nueva"):
    """Inserta una alerta con la política vigente, o con destinatarios explícitos."""
    with app.state.SessionLocal() as db:
        alerta = Alerta(astronauta_id=astro_id, tipo=tipo, nivel=nivel, mensaje="demo",
                        estado=estado,
                        destinatarios=(list(destinatarios) if destinatarios is not None
                                       else svc.destinatarios_politica(tipo, nivel)))
        db.add(alerta)
        db.commit()
        return alerta.id


def claves(obj):
    """Recorre el JSON y produce todas las claves anidadas."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield k
            yield from claves(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from claves(v)


@pytest.mark.parametrize("tipo,nivel,esperado", [
    ("news2", 2, ["astronauta", "medico", "tierra"]),
    ("news2", 1, ["astronauta", "medico"]),
    ("co2", 2, ["astronauta", "medico", "tierra"]),
    ("co2", 1, ["astronauta", "medico"]),
    ("desviacion", 2, ["astronauta", "medico", "tierra"]),
    ("desviacion", 1, ["astronauta", "medico"]),
    ("tendencia", 2, ["astronauta", "medico", "tierra"]),
    ("tendencia", 1, ["astronauta", "medico"]),
    ("sin_medicion", 2, ["medico", "tierra"]),
    ("sin_medicion", 1, ["medico", "tierra"]),
    ("sin_linea_base", 1, ["medico"]),
    ("cribado:sans", 2, ["medico", "astronauta"]),
    ("cribado:radiacion", 1, ["medico", "astronauta"]),
])
def test_politica_destinatarios_por_tipo_y_nivel(tipo, nivel, esperado):
    assert svc.destinatarios_politica(tipo, nivel) == esperado


def test_escalada_actualiza_destinatarios_y_conserva_ocurrencias(entorno):
    c, app, h = entorno
    a = astronauta(c, h)
    with app.state.SessionLocal() as db:
        alerta = svc.emitir_alerta(db, a, "news2", 1, "MEDIO")
        assert alerta.destinatarios == ["astronauta", "medico"]
        svc.emitir_alerta(db, a, "news2", 2, "ALTO")
        db.commit()
        assert alerta.nivel == "2" and alerta.estado == "nueva"
        assert alerta.destinatarios == ["astronauta", "medico", "tierra"]
        assert alerta.ocurrencias == 2
        eventos = [e.accion for e in db.scalars(select(AlertaEvento)
                   .where(AlertaEvento.alerta_id == alerta.id).order_by(AlertaEvento.id))]
        assert eventos == ["nueva", "escalada"]


def test_reiterada_conserva_ocurrencias_y_destinatarios(entorno):
    c, app, h = entorno
    a = astronauta(c, h)
    with app.state.SessionLocal() as db:
        alerta = svc.emitir_alerta(db, a, "co2", 2, "ALTO")
        svc.emitir_alerta(db, a, "co2", 2, "ALTO")
        db.commit()
        assert alerta.ocurrencias == 2
        assert alerta.destinatarios == ["astronauta", "medico", "tierra"]
        eventos = [e.accion for e in db.scalars(select(AlertaEvento)
                   .where(AlertaEvento.alerta_id == alerta.id).order_by(AlertaEvento.id))]
        assert eventos == ["nueva", "reiterada"]


def test_listado_filtra_antes_de_aplicar_limite(entorno):
    c, app, h = entorno
    a = astronauta(c, h)
    visible = alerta_directa(app, a, "sin_medicion", "1")
    for _ in range(5):
        alerta_directa(app, a, "cribado:sans", "1")
    tierra = usuario(c, h, "tierra")
    r = c.get("/alertas", headers=tierra, params={"limite": 1})
    assert r.status_code == 200, r.text
    assert [x["id"] for x in r.json()] == [visible]


def test_listado_por_rol_respeta_destinatarios(entorno):
    c, app, h = entorno
    a = astronauta(c, h)
    alerta_directa(app, a, "news2", "2")
    alerta_directa(app, a, "news2", "1")
    alerta_directa(app, a, "sin_medicion", "1")
    alerta_directa(app, a, "sin_linea_base", "1")
    alerta_directa(app, a, "cribado:sans", "1")

    def tipos(headers):
        return {x["tipo"] for x in c.get("/alertas", headers=headers).json()}

    tierra = usuario(c, h, "tierra")
    astro = usuario(c, h, "astronauta", a)
    medico = usuario(c, h, "medico")
    assert tipos(tierra) == {"news2", "sin_medicion"}
    assert tipos(astro) == {"news2", "cribado:sans"}
    assert tipos(medico) == {"news2", "sin_medicion", "sin_linea_base", "cribado:sans"}
    assert tipos(h) == {"news2", "sin_medicion", "sin_linea_base", "cribado:sans"}


def test_detalle_y_reconocer_respetan_destinatarios_y_auditan_403(entorno):
    c, app, h = entorno
    a = astronauta(c, h)
    otro = astronauta(c, h)
    cribado = alerta_directa(app, a, "cribado:sans", "1")
    sin_med = alerta_directa(app, a, "sin_medicion", "1")
    ajeno = alerta_directa(app, otro, "news2", "2")
    tierra = usuario(c, h, "tierra")
    astro = usuario(c, h, "astronauta", a)

    assert c.get(f"/alertas/{cribado}", headers=tierra).status_code == 403
    assert c.post(f"/alertas/{cribado}/reconocer", headers=tierra).status_code == 403
    assert c.get(f"/alertas/{sin_med}", headers=tierra).status_code == 200
    assert c.post(f"/alertas/{sin_med}/reconocer", headers=tierra).status_code == 200
    assert c.get(f"/alertas/{cribado}", headers=astro).status_code == 200
    assert c.get(f"/alertas/{ajeno}", headers=astro).status_code == 403

    with app.state.SessionLocal() as db:
        fallos = db.scalar(select(func.count()).select_from(Auditoria)
                           .where(Auditoria.exito.is_(False)))
        assert fallos >= 3


def test_alerta_antigua_con_destinatarios_amplios_no_aparece_en_tierra(entorno):
    c, app, h = entorno
    a = astronauta(c, h)
    cribado = alerta_directa(app, a, "cribado:sans", "1",
                             destinatarios=["astronauta", "medico", "tierra"])
    tierra = usuario(c, h, "tierra")
    assert c.get(f"/alertas/{cribado}", headers=tierra).status_code == 403
    assert all(x["id"] != cribado for x in c.get("/alertas", headers=tierra).json())
    medico = usuario(c, h, "medico")
    assert c.get(f"/alertas/{cribado}", headers=medico).status_code == 200


def test_medico_y_admin_ven_todas_las_alertas(entorno):
    c, app, h = entorno
    a = astronauta(c, h)
    ids = {alerta_directa(app, a, tipo, "1") for tipo in
           ("cribado:sans", "sin_linea_base", "sin_medicion", "news2")}
    medico = usuario(c, h, "medico")
    for headers in (h, medico):
        vistos = {x["id"] for x in c.get("/alertas", headers=headers).json()}
        assert ids <= vistos


def test_resolver_sigue_restringido_a_medico_y_admin(entorno):
    c, app, h = entorno
    a = astronauta(c, h)
    alerta = alerta_directa(app, a, "sin_medicion", "1")
    tierra = usuario(c, h, "tierra")
    assert c.post(f"/alertas/{alerta}/resolver", headers=tierra,
                  json={"nota": "nota valida"}).status_code == 403
    medico = usuario(c, h, "medico")
    assert c.post(f"/alertas/{alerta}/resolver", headers=medico,
                  json={"nota": "nota valida"}).status_code == 200


def test_tierra_minimiza_cribado_condiciones_evidencia_notas_y_ciclo(entorno):
    c, app, h = entorno
    a = astronauta(c, h, sexo="F", ciclo="natural",
                   ultima_menstruacion=(ahora().date() - timedelta(days=16)).isoformat())
    r = c.post(f"/astronautas/{a}/mediciones", headers=h, json={
        "ts": ahora().isoformat(), "contexto": "vuelo",
        "signos": {"fr": 14, "spo2": 98, "pas": 115, "fc": 64, "temp": 36.6},
        "complementarios": {"cambio_visual": True, "alteracion_animo": True}})
    assert r.status_code == 201, r.text
    e = r.json()["evaluacion"]
    assert "condiciones" in e["resultado"]
    assert any("temperatura esperada" in nota for nota in e["resultado"]["notas"])

    tierra = usuario(c, h, "tierra")
    respuestas = [
        c.get(f"/evaluaciones/{e['id']}", headers=tierra),
        c.get(f"/astronautas/{a}/historial", headers=tierra),
        c.post(f"/evaluaciones/{e['id']}/reproducir", headers=tierra),
    ]
    for resp in respuestas:
        assert resp.status_code == 200, resp.text
        conjunto = set(claves(resp.json()))
        assert "condiciones" not in conjunto
        assert "evidencia" not in conjunto
        assert "entrada" not in conjunto
        assert "alteracion_animo" not in resp.text
        assert "temperatura esperada" not in resp.text
    tipos_tierra = {x["tipo"] for x in c.get("/alertas", headers=tierra).json()}
    assert not any(t.startswith("cribado:") for t in tipos_tierra)


def test_tierra_conserva_notas_no_sensibles_y_valores_desconocidos():
    from types import SimpleNamespace
    from app.main import publico
    datos = {"notas":["Sin linea base personal", "Fase lutea: información restringida"],
             "co2_mmhg":None, "condiciones":[{"evidencia":["alteracion_animo"]}],
             "alertas":[{"tipo":"cribado:sans", "mensaje":"Detalle sensible"}]}
    salida = publico(datos, SimpleNamespace(rol="tierra"))
    assert salida["notas"] == ["Sin linea base personal"]
    assert "co2_mmhg" in salida and salida["co2_mmhg"] is None
    assert "condiciones" not in salida and salida["alertas"] == []
    for rol in ("admin", "medico", "astronauta"):
        assert publico(datos, SimpleNamespace(rol=rol)) == datos
