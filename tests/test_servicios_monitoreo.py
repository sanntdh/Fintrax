from datetime import timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import sessionmaker

from app.db import Alerta, AlertaEvento, Astronauta, Base, Evaluacion, LineaBaseDB, Medicion, ahora, crear_engine
from app.schemas import MedicionIn
from app import servicios as s
from enfermedades_espaciales import Estado


@pytest.fixture
def db():
    e = crear_engine("sqlite://")
    Base.metadata.create_all(e)
    with sessionmaker(e, expire_on_commit=False)() as sesion:
        s.reglas_activas(sesion)
        sesion.commit()
        yield sesion
    e.dispose()


def crear(db, **extra):
    a = Astronauta(nombre="Ficticio", sexo="M", estatura_m=1.8, masa_kg=80, edad=40, ciclo="no_aplica", **extra)
    db.add(a)
    db.commit()
    return a


def medir(db, a, contexto="preflight", **extra):
    signos = extra.pop("signos", {"fr": 14, "pas": 115, "fc": 64, "spo2": 98, "temp": 36.6})
    resultado = s.registrar_medicion(db, a, MedicionIn(contexto=contexto, signos=signos, **extra))
    db.commit()
    return resultado


def base(db, a):
    for d in range(10, 5, -1):
        medir(db, a, ts=ahora()-timedelta(days=d))
    return s.calcular_linea_base(db, a)


def test_calendario_intervalos_y_antiguedad():
    for dia, fase in [(1,"menstrual"),(5,"menstrual"),(6,"folicular"),(12,"folicular"),
                       (13,"ovulacion"),(15,"ovulacion"),(16,"lutea"),(28,"lutea")]:
        assert s.fase_del_dia(dia, 28) == fase
    for dur in (20, 46, True):
        with pytest.raises(ValueError):
            s.fase_del_dia(1, dur)
    a = SimpleNamespace(ciclo="natural", ultima_menstruacion=ahora().date()-timedelta(days=57), duracion_ciclo=28)
    assert s.derivar_fase(a, ahora())[0] is None
    assert "dos ciclos" in s.derivar_fase(a, ahora())[1]


def test_base_outliers_version_y_masa(db):
    a = crear(db)
    with pytest.raises(s.ErrorNegocio) as exc:
        s.calcular_linea_base(db, a)
    assert exc.value.status == 409
    primera = base(db, a)[0]
    medir(db, a, signos={"fc": 180, "fr":14,"pas":115,"temp":36.6,"spo2":98})
    segunda = s.calcular_linea_base(db, a)[0]
    assert segunda.fc == 64 and segunda.n_muestras == 5
    assert not primera.activa
    medir(db, a, contexto="vuelo", masa_kg=84)
    assert segunda.activa and segunda.desactualizada
    con_base = medir(db, a, contexto="vuelo")["evaluacion"]
    assert con_base.entrada["base"] is not None


def test_base_general_sin_lutea_y_fases(db):
    a = Astronauta(nombre="Ficticia", sexo="F", estatura_m=1.65, masa_kg=60, edad=36, ciclo="natural",
                   ultima_menstruacion=ahora().date()-timedelta(days=20), duracion_ciclo=28)
    db.add(a)
    db.flush()
    for dia in (1,2,3,4,5,16,17,18):
        ts = ahora()-timedelta(days=21-dia)
        medir(db, a, ts=ts, signos={"fc":64,"fr":14,"pas":115,"spo2":98,"temp":37 if dia>=16 else 36.6})
    bases = {b.fase_ciclo:b for b in s.calcular_linea_base(db, a)}
    assert bases[None].temp == 36.6 and bases[None].n_muestras == 5
    assert bases["lutea"].temp == 37 and bases["lutea"].n_muestras == 3


def test_persistencia_escalada_lifecycle_y_cribado(db):
    a = crear(db)
    base(db, a)
    signos = {"fc":84,"fr":14,"pas":115,"spo2":98,"temp":36.6}
    medir(db, a, contexto="vuelo", signos=signos, ts=ahora()-timedelta(hours=3))
    assert not db.scalar(select(Alerta).where(Alerta.tipo=="desviacion"))
    medir(db, a, contexto="vuelo", signos=signos, ts=ahora()-timedelta(hours=2))
    alerta = db.scalar(select(Alerta).where(Alerta.tipo=="desviacion"))
    assert alerta.nivel == "1"
    u = SimpleNamespace(nombre="Médico ficticio", rol="medico")
    s.cambiar_alerta(db, alerta, "reconocer", u)
    medir(db, a, contexto="vuelo", signos={**signos,"fc":100}, ts=ahora()-timedelta(hours=1))
    assert alerta.nivel == "2" and alerta.estado == "nueva" and alerta.ocurrencias == 2
    s.cambiar_alerta(db, alerta, "resolver", u, "Verificado en demostración")
    with pytest.raises(s.ErrorNegocio) as exc:
        s.cambiar_alerta(db, alerta, "resolver", u, "Nota válida")
    assert exc.value.status == 409
    medir(db, a, contexto="vuelo", complementarios={"cambio_visual":True,
        "dosimetria":{"dosis_msv":12,"limite_msv":10,"periodo":"ficticio"}})
    assert db.scalar(select(Alerta).where(Alerta.tipo=="cribado:sans")).nivel == "1"
    assert db.scalar(select(Alerta).where(Alerta.tipo=="cribado:radiacion")).nivel == "2"


def test_tendencia_regresion_y_alerta(db):
    a = crear(db)
    base(db, a)
    assert s.tendencia([])["estado"] == "insuficiente"
    for i, fc in enumerate((64,95,115,135)):
        medir(db, a, contexto="vuelo", ts=ahora()-timedelta(hours=4-i),
              signos={"fc":fc,"fr":14,"pas":115,"spo2":98,"temp":36.6})
    assert s.resumen_astronauta(db, a)["tendencia"]["estado"] == "empeorando"
    assert db.scalar(select(Alerta).where(Alerta.tipo=="tendencia"))
    for valores, esperado in [([3,2,1,0],"mejorando"),([1,1,1,1],"estable")]:
        assert s.tendencia([SimpleNamespace(news2_total=v) for v in valores])["estado"] == esperado


def test_sin_medicion_escala_y_siguiente_lectura_resuelve(db):
    a = crear(db)
    base(db, a)
    medir(db, a, contexto="vuelo", ts=ahora()-timedelta(hours=40))
    alertas = s.revisar_sin_medicion(db)
    assert len(alertas)==1 and alertas[0].nivel == "2"
    s.revisar_sin_medicion(db)
    assert alertas[0].ocurrencias == 2
    medir(db, a, contexto="vuelo")
    assert alertas[0].estado == "resuelta"
    assert db.scalar(select(func.count()).select_from(AlertaEvento)) >= 3


def test_reproducir_tras_nuevas_reglas_no_usa_las_actuales(db):
    a = crear(db)
    base(db, a)
    e = medir(db, a, contexto="vuelo", co2_mmhg=4)["evaluacion"]
    s.crear_version_reglas(db, {"co2_medio":4.5})
    db.commit()
    assert s.reproducir_evaluacion(db, e)["coincide"]
    parcial = s.crear_version_reglas(db, {"desv":{"fc":[20,40]}})
    assert parcial.contenido["desv"]["fc"] == [20,40]
    assert parcial.contenido["desv"]["pas"] == [15,30]
