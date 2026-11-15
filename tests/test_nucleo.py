"""Pruebas del nucleo puro de parametros: reglas, validacion y NEWS2.

Cubren S3 (dataclass Reglas y sus rangos) y S4 (validacion de entradas,
constantes publicas y contexto). Se ejecutan solo con la interfaz publica.
"""
import json
import math
from dataclasses import fields, replace

import pytest

import parametros
from parametros import (
    Ambiente, DESV, FASES_CICLO, FASES_MISION, LineaBase, Perfil,
    RANGOS_SIGNOS, REGLAS_DEFAULT, Reglas, Riesgo, Signos,
    carga_metabolica_rel, evaluar, news2, validar_entradas,
)
from reglas import Reglas as ReglasLegado, cargar_reglas


CAMPOS_DESV = ("fc", "pas", "fr", "temp", "spo2")


def _signos_normales():
    return Signos(fr=14, spo2=98, pas=115, fc=64, temp=36.7)


def _base_normal():
    return LineaBase(fc=62, pas=115, fr=14, temp=36.6, spo2=98)


# ---------------------------------------------------------------------------
# S3: valores por defecto y serializacion de Reglas
# ---------------------------------------------------------------------------
def test_reglas_default_y_desv_son_publicos_con_los_valores_de_s3():
    assert isinstance(REGLAS_DEFAULT, Reglas)
    assert set(DESV) == set(CAMPOS_DESV)
    assert dict(REGLAS_DEFAULT.desv) == {
        "fc": (15.0, 30.0),
        "pas": (15.0, 30.0),
        "fr": (4.0, 8.0),
        "temp": (0.8, 1.5),
        "spo2": (3.0, 5.0),
    }
    assert tuple(campo for campo, _ in REGLAS_DEFAULT.desv) == CAMPOS_DESV
    esperados = {
        "fc_regreso_gravedad": 6,
        "mult_pas_mujer_regreso": 0.8,
        "mult_esfuerzo": 1.5,
        "carga_min": 0.8,
        "carga_max": 1.25,
        "temp_lutea": 0.4,
        "mult_fc_lutea": 1.2,
        "co2_aviso": 2,
        "co2_medio": 4,
        "co2_alto": 5.3,
        "co2_critico": 10,
        "persistencia_desviacion": 2,
        "min_muestras_base": 5,
        "min_muestras_fase": 3,
        "horas_sin_medicion": 12,
        "tendencia_ventana": 6,
        "tendencia_pendiente": 0.5,
        "masa_cambio_recalcular": 0.05,
    }
    for campo, valor in esperados.items():
        assert getattr(REGLAS_DEFAULT, campo) == pytest.approx(valor)


def test_a_dict_es_json_y_desde_dict_reconstruye_la_misma_regla():
    datos = REGLAS_DEFAULT.a_dict()
    assert set(datos) == {campo.name for campo in fields(Reglas)}
    assert set(datos["desv"]) == set(CAMPOS_DESV)
    json.dumps(datos, allow_nan=False)
    assert Reglas.desde_dict(datos) == REGLAS_DEFAULT


def test_desde_dict_rechaza_campos_desconocidos_y_configuracion_no_dict():
    with pytest.raises(ValueError):
        Reglas.desde_dict({**REGLAS_DEFAULT.a_dict(), "desconocido": 1})
    with pytest.raises(ValueError):
        Reglas.desde_dict({"desviaciones": {}})
    with pytest.raises(ValueError):
        Reglas.desde_dict([])


def test_desde_dict_permite_configuracion_parcial_valida():
    r = Reglas.desde_dict({"co2_medio": 3.0, "co2_alto": 3.5})
    assert r.co2_medio == 3.0
    assert r.co2_alto == 3.5
    assert r.co2_aviso == REGLAS_DEFAULT.co2_aviso
    assert r.co2_critico == REGLAS_DEFAULT.co2_critico


def test_validar_es_publico_y_rechaza_un_objeto_manipulado():
    r = Reglas.desde_dict({})
    object.__setattr__(r, "fc_regreso_gravedad", -1)
    with pytest.raises(ValueError):
        r.validar()


# ---------------------------------------------------------------------------
# S3: rangos y rechazo de tipos especiales
# ---------------------------------------------------------------------------
RANGOS_FLOTANTES = [
    ("fc_regreso_gravedad", 0, 30),
    ("mult_pas_mujer_regreso", 0.3, 1),
    ("mult_esfuerzo", 1, 3),
    ("carga_min", 0.5, 1),
    ("carga_max", 1, 2),
    ("temp_lutea", 0, 1),
    ("mult_fc_lutea", 1, 2),
    ("horas_sin_medicion", 1, 168),
    ("tendencia_pendiente", 0.05, 5),
    ("masa_cambio_recalcular", 0.01, 0.5),
]


@pytest.mark.parametrize("campo,minimo,maximo", RANGOS_FLOTANTES)
def test_flotantes_de_reglas_aceptan_limites_y_rechazan_fuera_de_rango(campo, minimo, maximo):
    for valor in (minimo, maximo):
        assert getattr(Reglas.desde_dict({campo: valor}), campo) == pytest.approx(valor)
    invalidos = (minimo - 0.001, maximo + 0.001, math.nan, math.inf, -math.inf, True, "1")
    for valor in invalidos:
        with pytest.raises(ValueError):
            Reglas.desde_dict({campo: valor})


RANGOS_ENTEROS = [
    ("persistencia_desviacion", 1, 10),
    ("min_muestras_base", 3, 100),
    ("min_muestras_fase", 2, 50),
    ("tendencia_ventana", 3, 50),
]


@pytest.mark.parametrize("campo,minimo,maximo", RANGOS_ENTEROS)
def test_enteros_de_reglas_aceptan_limites_y_rechazan_tipos_no_enteros(campo, minimo, maximo):
    for valor in (minimo, maximo):
        r = Reglas.desde_dict({campo: valor})
        assert type(getattr(r, campo)) is int
        assert getattr(r, campo) == valor
    invalidos = (minimo - 1, maximo + 1, float(minimo), True, "3")
    for valor in invalidos:
        with pytest.raises(ValueError):
            Reglas.desde_dict({campo: valor})


def test_rangos_co2_aceptan_limites_y_rechazan_fuera_de_rango():
    casos_validos = [
        {"co2_aviso": 0, "co2_medio": 1, "co2_alto": 2, "co2_critico": 3},
        {"co2_aviso": 10, "co2_medio": 11, "co2_alto": 12, "co2_critico": 13},
        {"co2_aviso": 2, "co2_medio": 20, "co2_alto": 21, "co2_critico": 22},
        {"co2_aviso": 2, "co2_medio": 4, "co2_alto": 30, "co2_critico": 31},
        {"co2_aviso": 2, "co2_medio": 4, "co2_alto": 5.3, "co2_critico": 100},
    ]
    for cambios in casos_validos:
        r = Reglas.desde_dict(cambios)
        for campo, valor in cambios.items():
            assert getattr(r, campo) == pytest.approx(valor)
    invalidos = [
        {"co2_aviso": -0.1}, {"co2_aviso": 10.1},
        {"co2_medio": -0.1}, {"co2_medio": 20.1},
        {"co2_alto": -0.1}, {"co2_alto": 30.1},
        {"co2_critico": -0.1}, {"co2_critico": 100.1},
    ]
    for cambios in invalidos:
        with pytest.raises(ValueError):
            Reglas.desde_dict(cambios)


def test_umbrales_co2_exigen_orden_estricto():
    for cambios in [
        {"co2_medio": 2},       # igual a co2_aviso
        {"co2_alto": 4},        # igual a co2_medio
        {"co2_critico": 5.3},   # igual a co2_alto
        {"co2_aviso": 4},       # mayor que co2_medio
        {"co2_medio": 5.3},     # mayor que co2_alto
        {"co2_critico": 2},     # menor que co2_medio
    ]:
        with pytest.raises(ValueError):
            Reglas.desde_dict(cambios)


def _desv_valida():
    return {campo: list(REGLAS_DEFAULT.a_dict()["desv"][campo]) for campo in CAMPOS_DESV}


@pytest.mark.parametrize("cambios", [
    {"fc": [15, 30], "extra": [1, 2]},                 # clave desconocida
    {"fc": [0, 30]},                                   # medio no positivo
    {"fc": [30, 15]},                                  # alto menor que medio
    {"fc": [15, 15]},                                  # no estrictamente creciente
    {"fc": [math.nan, 30]},
    {"fc": [15, math.inf]},
    {"fc": [15, True]},
    {"fc": [15, "30"]},
    {"fc": [15]},
])
def test_desv_invalida_se_rechaza(cambios):
    desv = _desv_valida()
    desv.update(cambios)
    with pytest.raises(ValueError):
        Reglas.desde_dict({"desv": desv})


def test_desv_exige_exactamente_las_cinco_claves():
    desv = _desv_valida()
    del desv["spo2"]
    with pytest.raises(ValueError):
        Reglas.desde_dict({"desv": desv})
    desv = _desv_valida()
    desv["otro"] = [1, 2]
    with pytest.raises(ValueError):
        Reglas.desde_dict({"desv": desv})


# ---------------------------------------------------------------------------
# S3: compatibilidad con la Reglas congelada de reglas.py
# ---------------------------------------------------------------------------
def test_adaptador_convierte_una_regla_legada_y_conserva_sus_ajustes():
    legado = ReglasLegado.desde_dict({
        **cargar_reglas().snapshot(),
        "offset_temp_lutea": 0,
        "offset_fc_regreso": 2,
        "mult_pas_mujer": 0.5,
        "metabolismo_min": 0.6,
        "metabolismo_max": 1.4,
        "min_muestras": 4,
        "ausencia_horas": 9,
        "desviaciones": {"fc": [10, 20], "pas": [15, 30], "fr": [4, 8],
                         "temp": [0.8, 1.5], "spo2": [3, 5]},
    })
    perfil = Perfil("F", 1.65, 60, 36, "natural", "lutea")
    r = evaluar(perfil, replace(_signos_normales(), temp=37.5), Ambiente(), _base_normal(),
                reglas=legado)
    assert any("temperatura esperada +0 C" in nota for nota in r.notas)
    r_regreso = evaluar(perfil, _signos_normales(), Ambiente("regreso_gravedad"),
                        _base_normal(), reglas=legado)
    assert any("~+2 lpm" in nota for nota in r_regreso.notas)
    r_fc = evaluar(perfil, replace(_signos_normales(), fc=74), Ambiente(), _base_normal(),
                   reglas=legado)
    assert r_fc.niveles_capas["desviacion"] == Riesgo.MEDIO


def test_evaluar_no_acepta_un_dict_suelto_como_reglas():
    with pytest.raises(TypeError):
        evaluar(Perfil("M", 1.80, 80, 40), _signos_normales(), Ambiente(),
                _base_normal(), reglas=REGLAS_DEFAULT.a_dict())


# ---------------------------------------------------------------------------
# S4: validacion de entradas y constantes publicas
# ---------------------------------------------------------------------------
def test_constantes_de_fases_y_rangos_son_publicas():
    assert FASES_CICLO == ("menstrual", "folicular", "ovulacion", "lutea")
    assert FASES_MISION == ("vuelo", "regreso_gravedad", "eva", "superficie")
    assert RANGOS_SIGNOS == {
        "fr": (0, 70), "spo2": (50, 100), "pas": (40, 300),
        "fc": (0, 300), "temp": (25, 45), "co2_mmhg": (0, 100),
    }


def test_validar_entradas_acepta_limites_y_rechaza_fuera_de_rango():
    perfil = Perfil("M", 1.80, 80, 40)
    ambiente = Ambiente()
    for campo, minimo, maximo in [
        ("fr", 0, 70), ("spo2", 50, 100), ("pas", 40, 300),
        ("fc", 0, 300), ("temp", 25, 45),
    ]:
        for valor in (minimo, maximo):
            signos = Signos(fr=14, spo2=98, pas=115, fc=64, temp=36.7)
            setattr(signos, campo, valor)
            assert validar_entradas(perfil, signos, ambiente) is None
        for valor in (minimo - 0.1, maximo + 0.1, math.nan, math.inf, True, "14"):
            signos = Signos(fr=14, spo2=98, pas=115, fc=64, temp=36.7)
            setattr(signos, campo, valor)
            with pytest.raises(ValueError):
                validar_entradas(perfil, signos, ambiente)


def test_validar_entradas_perfil_y_ambiente_con_coherencia_de_ciclo():
    signos = _signos_normales()
    perfil = Perfil("F", 1.65, 60, 36, "natural", "lutea")
    assert validar_entradas(perfil, signos, Ambiente(fase="eva", co2_mmhg=0, ejercicio=True)) is None
    assert validar_entradas(perfil, signos, Ambiente(fase="superficie", co2_mmhg=100)) is None

    for campo, valor in [
        ("sexo", "X"), ("estatura_m", 1.19), ("estatura_m", 2.21),
        ("masa_kg", 29.9), ("masa_kg", 200.1), ("edad", 17), ("edad", 81),
        ("edad", 40.0), ("ciclo", "otro"), ("sexo", "M"),
    ]:
        p = Perfil("F", 1.65, 60, 36, "natural", "lutea")
        setattr(p, campo, valor)
        with pytest.raises(ValueError):
            validar_entradas(p, signos, Ambiente())

    p = Perfil("F", 1.65, 60, 36, "natural", "lutea")
    p.ciclo = "suprimido"
    with pytest.raises(ValueError):
        validar_entradas(p, signos, Ambiente())
    p = Perfil("F", 1.65, 60, 36, "natural", "lutea")
    p.fase_ciclo = "invalida"
    with pytest.raises(ValueError):
        validar_entradas(p, signos, Ambiente())

    for cambios in [{"fase": "marte"}, {"co2_mmhg": -0.1}, {"co2_mmhg": 100.1},
                    {"co2_mmhg": math.nan}, {"co2_mmhg": math.inf},
                    {"co2_mmhg": True}, {"ejercicio": 1}]:
        a = Ambiente()
        for campo, valor in cambios.items():
            setattr(a, campo, valor)
        with pytest.raises(ValueError):
            validar_entradas(Perfil("M", 1.80, 80, 40), signos, a)


def test_validar_entradas_booleanos_y_conciencia_estrictos():
    ambiente = Ambiente()
    perfil = Perfil("M", 1.80, 80, 40)
    for campo, valor in [("oxigeno_suplementario", 1), ("hipercapnico", "si"),
                         ("conciencia", "dormido")]:
        signos = _signos_normales()
        setattr(signos, campo, valor)
        with pytest.raises(ValueError):
            validar_entradas(perfil, signos, ambiente)


def test_evaluar_aplica_los_rangos_nuevos_aunque_el_dataclass_acepte_mas():
    # Estos objetos pasan la validacion historica del dataclass, pero no S4.
    with pytest.raises(ValueError):
        evaluar(Perfil("M", 1.1, 25, 81), _signos_normales(), Ambiente())
    with pytest.raises(ValueError):
        evaluar(Perfil("M", 1.80, 80, 40), replace(_signos_normales(), spo2=45), Ambiente())
    with pytest.raises(ValueError):
        evaluar(Perfil("M", 1.80, 80, 40), replace(_signos_normales(), fr=75), Ambiente())


def test_evaluar_rechaza_bases_no_finitas_y_fuera_de_rango():
    perfil = Perfil("M", 1.80, 80, 40)
    for valor in (math.nan, math.inf, -math.inf, True, 45):
        base = _base_normal()
        base.spo2 = valor
        with pytest.raises(ValueError):
            evaluar(perfil, _signos_normales(), Ambiente(), base)
    base = _base_normal()
    base.fc = math.nan
    with pytest.raises(ValueError):
        evaluar(perfil, _signos_normales(), Ambiente(), base, {"lutea": base})


# ---------------------------------------------------------------------------
# S4: NEWS2 exacto y jamás ajustado por contexto
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("campo,casos", [
    ("pas", [(90, 3), (91, 2), (100, 2), (101, 1), (110, 1), (111, 0), (219, 0), (220, 3)]),
    ("spo2", [(91, 3), (92, 2), (93, 2), (94, 1), (95, 1), (96, 0)]),
    ("fr", [(8, 3), (9, 1), (11, 1), (12, 0), (20, 0), (21, 2), (24, 2), (25, 3)]),
    ("fc", [(40, 3), (41, 1), (50, 1), (51, 0), (90, 0), (91, 1), (110, 1), (111, 2),
            (130, 2), (131, 3)]),
    ("temp", [(35, 3), (35.1, 1), (36, 1), (36.1, 0), (38, 0), (38.1, 1), (39, 1), (39.1, 2)]),
])
def test_tablas_news2_exactas(campo, casos):
    signos = _signos_normales()
    for valor, puntos in casos:
        assert news2(replace(signos, **{campo: valor}))[1][campo] == puntos


def test_news2_escala_dos_oxigeno_conciencia_y_total():
    signos = _signos_normales()
    for oxigeno, pares in [(False, [(83, 3), (84, 2), (86, 1), (88, 0), (100, 0)]),
                           (True, [(88, 0), (92, 0), (93, 1), (95, 2), (97, 3)])]:
        for spo2, puntos in pares:
            desglose = news2(replace(signos, spo2=spo2, hipercapnico=True,
                                     oxigeno_suplementario=oxigeno))[1]
            assert desglose["spo2"] == puntos
            assert desglose["oxigeno"] == (2 if oxigeno else 0)
    for conciencia in ("alerta", "confuso", "voz", "dolor", "inconsciente"):
        assert news2(replace(signos, conciencia=conciencia))[1]["conciencia"] == (
            0 if conciencia == "alerta" else 3)


def test_news2_no_se_ajusta_por_contexto_ni_por_reglas():
    base = evaluar(Perfil("M", 1.80, 80, 40), _signos_normales(), Ambiente(), _base_normal())
    contextos = [
        (Perfil("F", 1.65, 60, 36, "natural", "lutea"), Ambiente()),
        (Perfil("F", 1.65, 60, 36, "suprimido"), Ambiente("regreso_gravedad")),
        (Perfil("M", 1.70, 70, 40), Ambiente("eva", ejercicio=True)),
    ]
    for perfil, ambiente in contextos:
        r = evaluar(perfil, _signos_normales(), ambiente, _base_normal())
        assert r.news2_total == base.news2_total
        assert r.news2_desglose == base.news2_desglose
        assert r.niveles_capas["news2"] == base.niveles_capas["news2"]
    datos = REGLAS_DEFAULT.a_dict()
    datos["desv"] = {**datos["desv"], "fc": [1, 2]}
    r = evaluar(Perfil("M", 1.80, 80, 40), _signos_normales(), Ambiente(), _base_normal(),
                reglas=Reglas.desde_dict(datos))
    assert r.news2_total == base.news2_total
    assert r.news2_desglose == base.news2_desglose


# ---------------------------------------------------------------------------
# S4: contextos, ajustes y textos configurables
# ---------------------------------------------------------------------------
def test_contexto_lutea_ajusta_temperatura_fc_y_usa_base_por_fase():
    perfil = Perfil("F", 1.65, 60, 36, "natural", "lutea")
    signos = replace(_signos_normales(), temp=37.5)
    r = evaluar(perfil, signos, Ambiente(), _base_normal())
    assert r.niveles_capas["desviacion"] == Riesgo.BAJO
    assert any("Fase lutea: temperatura esperada +0.4 C" in nota for nota in r.notas)

    r_sin_fase = evaluar(replace(perfil, fase_ciclo=None), signos, Ambiente(), _base_normal())
    assert r_sin_fase.niveles_capas["desviacion"] == Riesgo.MEDIO

    base_fase = LineaBase(fc=62, pas=115, fr=14, temp=37.0, spo2=98)
    r_fase = evaluar(perfil, signos, Ambiente(), _base_normal(), {"lutea": base_fase})
    assert r_fase.niveles_capas["desviacion"] == Riesgo.BAJO
    assert not any("Fase lutea" in nota for nota in r_fase.notas)


def test_contexto_regreso_gravedad_usa_multiplicador_de_pas_por_sexo():
    base = LineaBase(fc=62, pas=115, fr=14, temp=36.6, spo2=98)
    signos = replace(_signos_normales(), pas=102)
    hombre = evaluar(Perfil("M", 1.80, 80, 40), signos, Ambiente("regreso_gravedad"), base)
    mujer = evaluar(Perfil("F", 1.65, 60, 36, "suprimido"), signos,
                    Ambiente("regreso_gravedad"), base)
    assert hombre.niveles_capas["desviacion"] == Riesgo.BAJO
    assert mujer.niveles_capas["desviacion"] == Riesgo.MEDIO
    assert any("Mayor sensibilidad a caida de PAS" in nota for nota in mujer.notas)
    assert any("~+6 lpm" in nota for nota in hombre.notas)


def test_contexto_esfuerzo_eva_amplia_fc_y_fr():
    base = LineaBase(fc=62, pas=115, fr=14, temp=36.6, spo2=98)
    perfil = Perfil("M", 1.70, 70, 40)
    signos = replace(_signos_normales(), fc=82)
    assert evaluar(perfil, signos, Ambiente(), base).niveles_capas["desviacion"] == Riesgo.MEDIO
    for ambiente in (Ambiente("eva"), Ambiente(ejercicio=True)):
        r = evaluar(perfil, signos, ambiente, base)
        assert r.niveles_capas["desviacion"] == Riesgo.BAJO
        assert any("carga metabolica relativa" in nota for nota in r.notas)


def test_reglas_customizadas_aparecen_en_las_notas_y_en_las_alertas_co2():
    datos = REGLAS_DEFAULT.a_dict()
    datos.update({"fc_regreso_gravedad": 2, "temp_lutea": 0.7, "mult_fc_lutea": 1.6})
    reglas = Reglas.desde_dict(datos)
    perfil = Perfil("F", 1.65, 60, 36, "natural", "lutea")
    r = evaluar(perfil, replace(_signos_normales(), temp=37.5), Ambiente(), _base_normal(),
                reglas=reglas)
    assert any("temperatura esperada +0.7 C" in nota for nota in r.notas)
    r_regreso = evaluar(perfil, _signos_normales(), Ambiente("regreso_gravedad"),
                        _base_normal(), reglas=reglas)
    assert any("~+2 lpm" in nota for nota in r_regreso.notas)

    datos = REGLAS_DEFAULT.a_dict()
    datos.update({"co2_aviso": 1, "co2_medio": 3, "co2_alto": 4, "co2_critico": 8})
    r = evaluar(Perfil("M", 1.80, 80, 40), _signos_normales(), Ambiente(co2_mmhg=3.5),
                reglas=Reglas.desde_dict(datos))
    assert r.niveles_capas["ambiente"] == Riesgo.MEDIO
    assert any("CO2 >= 3 mmHg: supera la regla de vuelo de la ISS" in alerta
               for alerta in r.alertas)


def test_textos_por_defecto_de_co2_se_conservan():
    perfil = Perfil("M", 1.80, 80, 40)
    r = evaluar(perfil, _signos_normales(), Ambiente(co2_mmhg=2))
    assert any(nota.startswith("CO2 >= 2 mmHg: posible cefalea") for nota in r.notas)
    r = evaluar(perfil, _signos_normales(), Ambiente(co2_mmhg=4))
    assert "CO2 >= 4 mmHg: supera la regla de vuelo de la ISS" in r.alertas
    r = evaluar(perfil, _signos_normales(), Ambiente(co2_mmhg=5.3))
    assert "CO2 >= 5.3 mmHg: supera el SMAC de 7-180 dias" in r.alertas
    r = evaluar(perfil, _signos_normales(), Ambiente(co2_mmhg=10))
    assert "CO2 >= 10 mmHg: supera el SMAC de 24 h" in r.alertas


def test_desviacion_usa_los_margenes_configurados_y_carga_metabolica_sus_limites():
    datos = REGLAS_DEFAULT.a_dict()
    datos["desv"] = {**datos["desv"], "fc": [10, 20]}
    r = evaluar(Perfil("M", 1.80, 80, 40), replace(_signos_normales(), fc=74),
                Ambiente(), _base_normal(), reglas=Reglas.desde_dict(datos))
    assert r.niveles_capas["desviacion"] == Riesgo.MEDIO

    datos = REGLAS_DEFAULT.a_dict()
    datos.update({"carga_min": 1.0, "carga_max": 1.0})
    assert carga_metabolica_rel(Perfil("M", 1.80, 80, 40),
                                Reglas.desde_dict(datos)) == pytest.approx(1.0)


def test_comportamiento_previo_normal_y_limites_metabolicos_por_defecto():
    r = evaluar(Perfil("M", 1.80, 80, 40), _signos_normales(), Ambiente(), _base_normal())
    assert r.nivel == Riesgo.BAJO
    assert r.niveles_capas["desviacion"] == Riesgo.BAJO
    assert isinstance(parametros.Reglas, type)
    assert carga_metabolica_rel(Perfil("M", 1.2, 30, 80)) == pytest.approx(0.8)
    assert carga_metabolica_rel(Perfil("M", 2.2, 200, 20)) == pytest.approx(1.25)
