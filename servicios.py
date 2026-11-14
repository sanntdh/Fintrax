"""Servicios puros: linea base robusta, calendario estimado y secuencia temporal."""
from datetime import date
from statistics import median

from parametros import LineaBase
from reglas import Reglas


def calcular_base(muestras, reglas: Reglas):
    campos = ("fc", "pas", "fr", "temp", "spo2")
    for s in muestras:
        s.__post_init__()
    retenidas = list(muestras)
    if muestras:
        centros = {c: median(getattr(s, c) for s in muestras) for c in campos}
        mad = {c: median(abs(getattr(s, c) - centros[c]) for s in muestras) for c in campos}
        retenidas = [s for s in muestras if all(
            (getattr(s, c) == centros[c] if mad[c] == 0 else
             abs(getattr(s, c) - centros[c]) / (1.4826 * mad[c]) <= reglas.mad_corte)
            for c in campos)]
    base = ({c: median(getattr(s, c) for s in retenidas) for c in campos}
            if len(retenidas) >= reglas.min_muestras else None)
    if base:
        LineaBase(**base)
    return {"base": base, "recibidas": len(muestras), "retenidas": len(retenidas),
            "descartadas": len(muestras) - len(retenidas),
            "minimo": reglas.min_muestras, "metodo": "mediana_MAD_interseccion_v1"}


def estimar_fase(ultima: date, duracion: int, fecha: date, reglas: Reglas):
    if type(duracion) is not int or not 21 <= duracion <= 45:
        raise ValueError("duracion_ciclo: entero entre 21 y 45 requerido")
    dia = (fecha - ultima).days + 1
    if dia < 1:
        raise ValueError("fecha de observacion anterior al calendario registrado")
    if dia > duracion:
        fase = None  # no proyectar indefinidamente ciclos sin observaciones nuevas
    elif dia <= reglas.dias_menstruacion:
        fase = "menstrual"
    elif dia < duracion - reglas.dias_lutea:
        fase = "folicular"
    elif dia == duracion - reglas.dias_lutea:
        fase = "ovulacion"
    else:
        fase = "lutea"
    return {"fase": fase, "estimada": True,
            "limitacion": "Estimacion por calendario, no confirma ovulacion; no activa ajustes fisiologicos."}


def temporal(previas, timestamp, nivel, news2, urgente, reglas: Reglas):
    consecutivas = 1 if nivel >= 1 else 0
    anterior = timestamp
    for registro in reversed(previas):
        separacion = (anterior - registro["timestamp"]).total_seconds()
        if separacion <= 0 or separacion > reglas.separacion_max_horas * 3600 or registro["nivel"] < 1:
            break
        if not consecutivas:
            break
        consecutivas += 1
        anterior = registro["timestamp"]
    ultimo = previas[-1] if previas else None
    comparable = ultimo and 0 < (timestamp - ultimo["timestamp"]).total_seconds() <= reglas.separacion_max_horas * 3600
    delta = news2 - ultimo["news2"] if comparable else None
    return {"consecutivas": consecutivas,
            "emitir": bool(urgente or nivel >= 2 or consecutivas >= reglas.lecturas_consecutivas),
            "delta_news2": delta,
            "tendencia_news2": ("sin_comparacion" if delta is None else
                                "ascendente" if delta > 0 else "descendente" if delta < 0 else "estable")}
