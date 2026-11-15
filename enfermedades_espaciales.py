"""Cribado exploratorio basado en evidencia complementaria; no diagnostico medico.

Los PDF justifican las areas vigiladas, no validan estas reglas de cribado.
None significa no medido/no preguntado, nunca ausencia de enfermedad.
"""
from dataclasses import dataclass
from enum import Enum
from math import isclose, isfinite
from typing import Optional


class Estado(str, Enum):
    NO_EVALUABLE = "no_evaluable"
    SIN_SENALES = "sin_senales_en_datos_aportados"
    SOSPECHA = "hallazgo_compatible_requiere_evaluacion"
    EXPOSICION_REGISTRADA = "exposicion_registrada"
    LIMITE_SUPERADO = "limite_de_protocolo_alcanzado_o_superado"


@dataclass
class MedicionComparada:
    """Basal y actual: misma unidad, sitio y tecnica, confirmado por comparables.

    cambio_minimo: cambio significativo del instrumento/protocolo en esas unidades
    (p. ej., LSC de DXA); no un umbral diagnostico ni un promedio poblacional.
    """
    basal: Optional[float] = None
    actual: Optional[float] = None
    cambio_minimo: Optional[float] = None
    comparables: Optional[bool] = None


@dataclass
class Dosimetria:
    """Dosis equivalente y limite del protocolo en mSv para el mismo periodo.

    El periodo identifica la ventana compartida, p. ej. 'mision actual'. El limite
    debe proceder del equipo responsable; nunca se deduce de estos articulos.
    """
    dosis_msv: Optional[float] = None
    limite_msv: Optional[float] = None
    periodo: Optional[str] = None


@dataclass
class DatosComplementarios:
    dosimetria: Optional[Dosimetria] = None
    densidad_osea: Optional[MedicionComparada] = None
    fuerza_muscular: Optional[MedicionComparada] = None
    cambio_visual: Optional[bool] = None
    hallazgo_ocular: Optional[bool] = None  # examen oftalmologico interpretado
    sintomas_al_incorporarse: Optional[bool] = None  # mareo/presincope al ponerse de pie
    alteracion_sueno: Optional[bool] = None
    alteracion_animo: Optional[bool] = None  # malestar emocional referido, no diagnostico
    dificultad_cognitiva: Optional[bool] = None
    mareo_desorientacion: Optional[bool] = None
    evaluacion_inmune_anormal: Optional[bool] = None  # laboratorio interpretado por clinico


@dataclass
class CondicionEvaluada:
    codigo: str
    nombre: str
    estado: Estado
    evidencia: list[str]
    datos_faltantes: list[str]
    recomendacion: str
    limitacion: str
    fuentes: list[str]


_EXON = "Documentación/ef91c634202c62c63a17ee801c4a2c4a1021.pdf"
_FISIO = "Documentación/9f6c57e2e18d8e6baa6a8ea8d4c7a5841539.pdf"
_LIMEN = "Documentación/LIMEN.S.P.2024.169.pdf"
_LIMITACION = (
    "Cribado exploratorio no validado en vuelo: no diagnostica ni descarta enfermedad "
    "ni atribuye su causa al vuelo espacial. Requiere interpretacion clinica."
)


def _numero(nombre, valor, positivo=False):
    if valor is None:
        return
    if (isinstance(valor, bool) or not isinstance(valor, (int, float))
            or not isfinite(valor) or valor < 0 or (positivo and valor == 0)):
        raise ValueError(f"{nombre}: se requiere un numero finito {'positivo' if positivo else 'no negativo'}")


def _booleano(nombre, valor):
    if valor is not None and type(valor) is not bool:
        raise ValueError(f"{nombre}: use True, False o None")


def _validar(datos):
    if not isinstance(datos, DatosComplementarios):
        raise ValueError("complementarios: se requiere DatosComplementarios")
    for campo in ("densidad_osea", "fuerza_muscular"):
        medida = getattr(datos, campo)
        if medida is None:
            continue
        if not isinstance(medida, MedicionComparada):
            raise ValueError(f"{campo}: se requiere MedicionComparada")
        _numero(f"{campo}.basal", medida.basal, positivo=True)
        _numero(f"{campo}.actual", medida.actual, positivo=True)
        _numero(f"{campo}.cambio_minimo", medida.cambio_minimo)
        _booleano(f"{campo}.comparables", medida.comparables)
    d = datos.dosimetria
    if d is not None:
        if not isinstance(d, Dosimetria):
            raise ValueError("dosimetria: se requiere Dosimetria")
        _numero("dosis_msv", d.dosis_msv)
        _numero("limite_msv", d.limite_msv, positivo=True)
        if d.periodo is not None and (not isinstance(d.periodo, str) or not d.periodo.strip()):
            raise ValueError("periodo: se requiere texto no vacio o None")
    for campo in ("cambio_visual", "hallazgo_ocular", "sintomas_al_incorporarse",
                  "alteracion_sueno", "alteracion_animo", "dificultad_cognitiva",
                  "mareo_desorientacion", "evaluacion_inmune_anormal"):
        _booleano(campo, getattr(datos, campo))


def _resultado(codigo, nombre, estado, evidencia, faltantes, recomendacion, fuentes):
    return CondicionEvaluada(codigo, nombre, estado, evidencia, faltantes,
                            recomendacion, _LIMITACION, fuentes)


def _comparacion(codigo, nombre, medida, campo, fuentes):
    medida = medida if medida is not None else MedicionComparada()
    faltantes = [f"{campo}.{c}" for c in ("basal", "actual", "cambio_minimo")
                 if getattr(medida, c) is None]
    if medida.comparables is not True:
        faltantes.append(f"{campo}.comparables")
    evidencia = []
    estado = Estado.NO_EVALUABLE
    if not faltantes:
        perdida = medida.basal - medida.actual
        evidencia.append(f"Descenso medido: {perdida:.6g}; cambio minimo: {medida.cambio_minimo:.6g}")
        supera = (perdida > medida.cambio_minimo
                  and not isclose(perdida, medida.cambio_minimo, rel_tol=1e-12))
        estado = Estado.SOSPECHA if supera else Estado.SIN_SENALES
    return _resultado(codigo, nombre, estado, evidencia, faltantes,
                      "Revisar mediciones comparables con medicina de vuelo; no equivale a osteoporosis ni atrofia confirmada.",
                      fuentes)


def evaluar_condiciones(datos: DatosComplementarios) -> list[CondicionEvaluada]:
    """Evalua cada area por separado; un positivo no se oculta por datos faltantes.

    SIN_SENALES solo describe los datos aportados, no ausencia de patologia.
    No modifica NEWS2 ni asigna gravedad aguda a enfermedades cronicas.
    """
    _validar(datos)
    d = datos.dosimetria if datos.dosimetria is not None else Dosimetria()
    faltantes = [c for c in ("dosis_msv", "limite_msv", "periodo") if getattr(d, c) is None]
    estado, evidencia = Estado.NO_EVALUABLE, []
    if d.dosis_msv is not None:
        estado = Estado.EXPOSICION_REGISTRADA
        evidencia.append(f"Dosimetria registrada: {d.dosis_msv:g} mSv")
        if not faltantes:
            evidencia.append(f"Limite de protocolo: {d.limite_msv:g} mSv; periodo: {d.periodo}")
            if d.dosis_msv >= d.limite_msv:
                estado = Estado.LIMITE_SUPERADO
    resultados = [_resultado(
        "radiacion", "Exposicion a radiacion", estado, evidencia, faltantes,
        "Revisar dosimetria y protocolo con proteccion radiologica; no predice cancer, cataratas ni dano de ADN.",
        [f"{_EXON}, p. 3", f"{_LIMEN}, pp. 2–3 (170–171)"])]
    resultados.append(_comparacion("perdida_osea", "Perdida mineral osea", datos.densidad_osea,
                                   "densidad_osea", [f"{_EXON}, p. 8", f"{_FISIO}, p. 2"]))
    resultados.append(_comparacion("deterioro_muscular", "Deterioro de fuerza muscular",
                                   datos.fuerza_muscular, "fuerza_muscular",
                                   [f"{_FISIO}, p. 2", f"{_FISIO}, p. 12 (contramedidas)"]))
    grupos = [
        ("sans", "Hallazgos compatibles con riesgo neuro-ocular (SANS)",
         ("cambio_visual", "hallazgo_ocular"),
         "Solicitar evaluacion oftalmologica (fondo de ojo/OCT segun disponibilidad); los sintomas visuales no son especificos de SANS.",
         [f"{_EXON}, p. 4", f"{_FISIO}, p. 12"]),
        ("intolerancia_ortostatica", "Sintomas compatibles con intolerancia ortostatica",
         ("sintomas_al_incorporarse",),
         "Evaluar postura, sintomas y presion arterial/FC con supervision clinica; no realizar pruebas de pie sin apoyo si hay presincope.",
         [f"{_FISIO}, pp. 2, 5", f"{_EXON}, pp. 2, 6"]),
        ("salud_mental_sueno", "Alteracion referida de sueno, animo o cognicion",
         ("alteracion_sueno", "alteracion_animo", "dificultad_cognitiva"),
         "Solicitar evaluacion de sueno y salud mental; estos datos no diagnostican depresion, ansiedad ni space fog.",
         [f"{_LIMEN}, p. 3 (171)", f"{_EXON}, pp. 8–9"]),
        ("alteracion_vestibular", "Sintomas vestibulares o de orientacion",
         ("mareo_desorientacion",),
         "Evaluar equilibrio y orientacion; el mareo no identifica por si solo su causa ni confirma cinetosis espacial.",
         [f"{_EXON}, p. 8", f"{_FISIO}, p. 2"]),
        ("alteracion_inmunitaria", "Evaluacion inmunitaria anormal",
         ("evaluacion_inmune_anormal",),
         "Revisar laboratorio y contexto con el equipo medico; no infiere infeccion ni inmunosupresion desde signos vitales.",
         [f"{_EXON}, pp. 3–4", f"{_FISIO}, p. 12"]),
    ]
    for codigo, nombre, campos, recomendacion, fuentes in grupos:
        positivos = [campo for campo in campos if getattr(datos, campo) is True]
        faltantes = [campo for campo in campos if getattr(datos, campo) is None]
        estado = (Estado.SOSPECHA if positivos else
                  Estado.NO_EVALUABLE if faltantes else Estado.SIN_SENALES)
        resultados.append(_resultado(codigo, nombre, estado, positivos, faltantes,
                                     recomendacion, fuentes))
    return resultados
