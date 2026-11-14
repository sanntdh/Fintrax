"""Limites de captura para adultos, no umbrales de normalidad clinica."""
from math import isfinite

RANGOS = {"fc": (0, 300), "fr": (0, 100), "pas": (0, 300),
          "temp": (25, 45), "spo2": (0, 100), "masa_kg": (2, 400),
          "estatura_m": (0.5, 2.5), "edad": (18, 100), "co2_mmhg": (0, 100)}
FASES_CICLO = ("menstrual", "folicular", "ovulacion", "lutea")


def numero(campo, valor):
    bajo, alto = RANGOS[campo]
    if (isinstance(valor, bool) or not isinstance(valor, (float, int))
            or not isfinite(valor) or not bajo <= valor <= alto):
        raise ValueError(f"{campo}: numero finito entre {bajo} y {alto} requerido")


def booleano(campo, valor):
    if type(valor) is not bool:
        raise ValueError(f"{campo}: booleano requerido")


def opcion(campo, valor, opciones):
    if valor not in opciones:
        raise ValueError(f"{campo}: opcion no permitida")


def signos(s):
    for campo in ("fc", "fr", "pas", "temp", "spo2"):
        numero(campo, getattr(s, campo))


def perfil(p):
    opcion("sexo", p.sexo, ("F", "M"))
    for campo in ("estatura_m", "masa_kg", "edad"):
        numero(campo, getattr(p, campo))
    if type(p.edad) is not int:
        raise ValueError("edad: entero requerido")
    opcion("ciclo", p.ciclo, ("natural", "suprimido", "no_aplica"))
    opcion("fase_ciclo", p.fase_ciclo, (None, *FASES_CICLO))
    if (p.ciclo != "natural" and p.fase_ciclo is not None) or (p.sexo != "F" and p.ciclo != "no_aplica"):
        raise ValueError("ciclo/fase incompatibles con el perfil")
