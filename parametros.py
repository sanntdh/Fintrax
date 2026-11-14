"""
parametros.py - Clasificacion de riesgo (BAJO / MEDIO / ALTO) para monitoreo
de salud de astronautas.

Capas:
  1. NEWS2 absoluto: piso de seguridad, NUNCA se ajusta (evita enmascarar alertas).
  2. Desviacion vs linea base personal, con ajustes por ambiente, sexo, tamano
     corporal y ciclo menstrual.
  3. Alertas de ambiente (CO2 de cabina).
Nivel final = el MAS ALTO de las tres capas.
El cribado complementario se informa por separado y no diagnostica enfermedades.

IMPORTANTE: NEWS2 es del Royal College of Physicians/NHS (no de NASA) y no esta
validado en vuelo. Todo lo marcado [CALIBRAR] es una hipotesis de diseno, no un
valor NASA, y debe validarse con datos reales o con un medico.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import IntEnum
from typing import Optional

from enfermedades_espaciales import (
    CondicionEvaluada, DatosComplementarios, evaluar_condiciones,
)

INF = float("inf")


class Riesgo(IntEnum):
    BAJO = 0
    MEDIO = 1
    ALTO = 2


# ----------------------------------------------------------------------------
# Datos de entrada
# ----------------------------------------------------------------------------
@dataclass
class Perfil:
    sexo: str                              # "F" | "M"
    estatura_m: float
    masa_kg: float                         # actualizar durante la mision (la masa baja en vuelo)
    edad: int
    ciclo: str = "no_aplica"               # "natural" | "suprimido" | "no_aplica"
    fase_ciclo: Optional[str] = None       # "menstrual" | "folicular" | "ovulacion" | "lutea"


@dataclass
class Ambiente:
    fase: str = "vuelo"                    # "vuelo" | "regreso_gravedad" | "eva" | "superficie"
    co2_mmhg: Optional[float] = None       # presion parcial de CO2 de cabina
    ejercicio: bool = False


@dataclass
class Signos:
    fr: float                              # respiraciones/min
    spo2: float                            # %
    pas: float                             # mmHg
    fc: float                              # lpm
    temp: float                            # grados C
    conciencia: str = "alerta"             # "alerta" | "confuso" | "voz" | "dolor" | "inconsciente"
    oxigeno_suplementario: bool = False
    hipercapnico: bool = False             # escala 2 de SpO2


@dataclass
class LineaBase:
    fc: float
    pas: float
    fr: float
    temp: float
    spo2: float


@dataclass
class Resultado:
    nivel: Riesgo
    news2_total: int
    news2_desglose: dict
    niveles_capas: dict
    alertas: list = field(default_factory=list)
    notas: list = field(default_factory=list)
    condiciones: list[CondicionEvaluada] = field(default_factory=list)


# ----------------------------------------------------------------------------
# Capa 1: NEWS2 (Royal College of Physicians, 2017)
# ----------------------------------------------------------------------------
def _rango(valor: float, tabla: list) -> int:
    for limite, pts in tabla:
        if valor <= limite:
            return pts
    return tabla[-1][1]


_FR = [(8, 3), (11, 1), (20, 0), (24, 2), (INF, 3)]
_PAS = [(90, 3), (100, 2), (110, 1), (219, 0), (INF, 3)]
_FC = [(40, 3), (50, 1), (90, 0), (110, 1), (130, 2), (INF, 3)]
_TEMP = [(35.0, 3), (36.0, 1), (38.0, 0), (39.0, 1), (INF, 2)]


def _pts_spo2(s: float, oxigeno: bool, hipercapnico: bool) -> int:
    if not hipercapnico:                   # escala 1
        return 0 if s >= 96 else 1 if s >= 94 else 2 if s >= 92 else 3
    if oxigeno and s >= 93:                # escala 2 con oxigeno
        return 3 if s >= 97 else 2 if s >= 95 else 1
    return 0 if s >= 88 else 1 if s >= 86 else 2 if s >= 84 else 3


def news2(s: Signos) -> tuple[int, dict]:
    if s.conciencia not in ("alerta", "confuso", "voz", "dolor", "inconsciente"):
        raise ValueError(f"conciencia invalida: {s.conciencia}")
    d = {
        "fr": _rango(s.fr, _FR),
        "spo2": _pts_spo2(s.spo2, s.oxigeno_suplementario, s.hipercapnico),
        "oxigeno": 2 if s.oxigeno_suplementario else 0,
        "pas": _rango(s.pas, _PAS),
        "fc": _rango(s.fc, _FC),
        "conciencia": 0 if s.conciencia == "alerta" else 3,
        "temp": _rango(s.temp, _TEMP),
    }
    return sum(d.values()), d


def _nivel_news2(total: int, desglose: dict) -> Riesgo:
    if total >= 7:
        return Riesgo.ALTO
    if total >= 5 or any(v == 3 for v in desglose.values()):
        return Riesgo.MEDIO               # un solo parametro en 3 = revision urgente
    return Riesgo.BAJO


# ----------------------------------------------------------------------------
# Tamano corporal: Harris-Benedict revisada (NASA la usa para el gasto basal
# y considera estatura, peso, edad y sexo)
# ----------------------------------------------------------------------------
def gasto_basal(p: Perfil) -> float:
    cm = p.estatura_m * 100
    if p.sexo == "F":
        return 447.593 + 9.247 * p.masa_kg + 3.098 * cm - 4.330 * p.edad
    return 88.362 + 13.397 * p.masa_kg + 4.799 * cm - 5.677 * p.edad


_BEE_REF = 88.362 + 13.397 * 70 + 4.799 * 170 - 5.677 * 40   # referencia: 1.70 m, 70 kg, 40 anos


def carga_metabolica_rel(p: Perfil) -> float:
    """Gasto basal relativo a la referencia, acotado a [0.8, 1.25] [CALIBRAR]."""
    return min(1.25, max(0.8, gasto_basal(p) / _BEE_REF))


# ----------------------------------------------------------------------------
# Capa 2: desviacion vs linea base personal
# ----------------------------------------------------------------------------
# (margen MEDIO, margen ALTO) respecto a la linea base ajustada [CALIBRAR]
DESV = {"fc": (15, 30), "pas": (15, 30), "fr": (4, 8), "temp": (0.8, 1.5), "spo2": (3, 5)}


def _contexto(p: Perfil, a: Ambiente, base_de_fase: bool):
    """Devuelve (offsets esperados, multiplicadores de margen, notas).
    mult > 1 = mas tolerancia; mult < 1 = mas sensibilidad."""
    off = {k: 0.0 for k in DESV}
    mult = {k: 1.0 for k in DESV}
    notas: list[str] = []

    if a.fase == "regreso_gravedad":
        off["fc"] += 6        # NASA/Hughson 2012: FC +5-6 lpm tras vuelo
        notas.append("Regreso a gravedad: se espera FC ~+6 lpm y menor respuesta del barorreflejo.")
        if p.sexo == "F":
            mult["pas"] *= 0.8   # mayor incidencia de presincope en mujeres [CALIBRAR]
            notas.append("Mayor sensibilidad a caida de PAS (ortostatismo mas frecuente en mujeres).")

    if a.ejercicio or a.fase == "eva":
        k = carga_metabolica_rel(p)
        for par in ("fc", "fr"):
            mult[par] *= 1.5 * k  # el esfuerzo sube FC/FR; el tamano escala la carga [CALIBRAR]
        notas.append(f"Esfuerzo/EVA: margenes de FC y FR ampliados (carga metabolica relativa {k:.2f}).")

    if p.sexo == "F" and p.ciclo == "suprimido":
        notas.append("Ciclo suprimido con anticoncepcion hormonal: sin ajuste por fase. "
                     "Vigilar dolor/hinchazon de pierna o disnea subita (riesgo de TVP/TEP no caracterizado en vuelo).")
    elif p.sexo == "F" and p.ciclo == "natural":
        if p.fase_ciclo == "lutea" and not base_de_fase:
            off["temp"] += 0.4    # temperatura basal +0.3-0.5 C tras ovulacion
            mult["fc"] *= 1.2     # mayor actividad simpatica en fase lutea [CALIBRAR]
            notas.append("Fase lutea: temperatura esperada +0.4 C y margen de FC ampliado.")
        if p.fase_ciclo in ("menstrual", "folicular") and a.fase == "regreso_gravedad":
            notas.append("Fase menstrual/folicular temprana: vigilar mareo al ponerse de pie "
                         "(evidencia mixta; la linea base personal manda).")
    return off, mult, notas


def _nivel_desviacion(s: Signos, base: LineaBase, off: dict, mult: dict):
    actual = {"fc": s.fc, "pas": s.pas, "fr": s.fr, "temp": s.temp, "spo2": s.spo2}
    esperado = {k: getattr(base, k) + off[k] for k in actual}
    nivel, alertas = Riesgo.BAJO, []
    for par, valor in actual.items():
        delta = valor - esperado[par]
        if par == "spo2":
            delta = abs(min(delta, 0.0))          # solo importan las caidas
        else:
            delta = abs(delta)
        medio, alto = (m * mult[par] for m in DESV[par])
        if delta >= alto:
            nivel = max(nivel, Riesgo.ALTO)
            alertas.append(f"{par}: desviacion {delta:.1f} >= {alto:.1f} (ALTO)")
        elif delta >= medio:
            nivel = max(nivel, Riesgo.MEDIO)
            alertas.append(f"{par}: desviacion {delta:.1f} >= {medio:.1f} (MEDIO)")
    return nivel, alertas


# ----------------------------------------------------------------------------
# Capa 3: ambiente (CO2 de cabina)
# Regla de vuelo ISS 4 mmHg; SMAC 5.3 mmHg (7-180 d) y 10 mmHg (24 h)
# ----------------------------------------------------------------------------
def _nivel_co2(co2: Optional[float]):
    if co2 is None:
        return Riesgo.BAJO, [], []
    if co2 >= 10:
        return Riesgo.ALTO, ["CO2 >= 10 mmHg: supera el SMAC de 24 h"], []
    if co2 >= 5.3:
        return Riesgo.ALTO, ["CO2 >= 5.3 mmHg: supera el SMAC de 7-180 dias"], []
    if co2 >= 4:
        return Riesgo.MEDIO, ["CO2 >= 4 mmHg: supera la regla de vuelo de la ISS"], []
    if co2 >= 2:
        return Riesgo.BAJO, [], ["CO2 >= 2 mmHg: posible cefalea, letargo o menor rendimiento cognitivo "
                                 "aun bajo el limite."]
    return Riesgo.BAJO, [], []


# ----------------------------------------------------------------------------
# Funcion principal
# ----------------------------------------------------------------------------
def evaluar(perfil: Perfil, signos: Signos, ambiente: Ambiente,
             base: Optional[LineaBase] = None,
             base_por_fase: Optional[dict] = None,
             *, complementarios: Optional[DatosComplementarios] = None) -> Resultado:
    """base: linea base personal preflight.
    base_por_fase: opcional {"lutea": LineaBase, ...}; si existe para la fase actual,
    reemplaza a `base` y evita los ajustes genericos de ciclo.
    complementarios: evidencia opcional para cribado, separado del nivel agudo.
    Sin datos, las condiciones complementarias quedan no evaluables."""
    total, desglose = news2(signos)
    n_news2 = _nivel_news2(total, desglose)

    usa_base_fase = bool(base_por_fase and perfil.fase_ciclo in base_por_fase
                         and perfil.ciclo == "natural")
    if usa_base_fase:
        base = base_por_fase[perfil.fase_ciclo]

    off, mult, notas = _contexto(perfil, ambiente, usa_base_fase)
    alertas: list[str] = []

    if base is None:
        n_desv = Riesgo.BAJO
        notas.append("Sin linea base personal: se evalua solo con NEWS2 y ambiente.")
    else:
        n_desv, a_desv = _nivel_desviacion(signos, base, off, mult)
        alertas += a_desv

    n_co2, a_co2, n_co2_notas = _nivel_co2(ambiente.co2_mmhg)
    alertas += a_co2
    notas += n_co2_notas

    if n_news2 >= Riesgo.MEDIO:
        alertas.insert(0, f"NEWS2 total {total}: {desglose}")

    capas = {"news2": n_news2, "desviacion": n_desv, "ambiente": n_co2}
    condiciones = evaluar_condiciones(
        complementarios if complementarios is not None else DatosComplementarios())
    return Resultado(max(capas.values()), total, desglose, capas, alertas, notas, condiciones)


# ----------------------------------------------------------------------------
# Demo
# ----------------------------------------------------------------------------
if __name__ == "__main__":
    base = LineaBase(fc=62, pas=115, fr=14, temp=36.6, spo2=98)
    ella = Perfil("F", 1.65, 60, 36, ciclo="natural", fase_ciclo="lutea")
    el = Perfil("M", 1.80, 80, 40)
    vuelo = Ambiente("vuelo", co2_mmhg=3.0)

    casos = [
        ("1. Hombre en vuelo, todo normal",
         el, Signos(fr=14, spo2=98, pas=115, fc=64, temp=36.7), vuelo, base),
        ("2. Mujer fase lutea, temp 37.5 (sube por ciclo)",
         ella, Signos(fr=14, spo2=98, pas=115, fc=66, temp=37.5), vuelo, base),
        ("3. Misma mujer, ciclo natural pero sin saber la fase",
         Perfil("F", 1.65, 60, 36, ciclo="natural"),
         Signos(fr=14, spo2=98, pas=115, fc=66, temp=37.5), vuelo, base),
        ("4. Mujer, regreso a gravedad, PAS baja 115->98",
         Perfil("F", 1.65, 60, 36, ciclo="suprimido"),
         Signos(fr=14, spo2=98, pas=98, fc=72, temp=36.6),
         Ambiente("regreso_gravedad"), base),
        ("5. Deterioro grave (NEWS2 alto)",
         el, Signos(fr=26, spo2=92, pas=95, fc=135, temp=38.6, conciencia="confuso"), vuelo, base),
        ("6. Signos normales pero CO2 de cabina 5.5 mmHg",
         el, Signos(fr=14, spo2=98, pas=115, fc=64, temp=36.7),
         Ambiente("vuelo", co2_mmhg=5.5), base),
    ]
    for titulo, perfil, signos, amb, b in casos:
        r = evaluar(perfil, signos, amb, b)
        print(f"\n{titulo}\n  NIVEL: {r.nivel.name} | NEWS2={r.news2_total} | capas="
              f"{ {k: v.name for k, v in r.niveles_capas.items()} }")
        for x in r.alertas:
            print("  alerta:", x)
        for x in r.notas:
            print("  nota:", x)
