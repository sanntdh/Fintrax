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

from dataclasses import dataclass, field, fields
from enum import IntEnum
from math import isfinite
from typing import Optional
import validacion
from reglas import cargar_reglas

from enfermedades_espaciales import (
    CondicionEvaluada, DatosComplementarios, evaluar_condiciones,
)

INF = float("inf")


class Riesgo(IntEnum):
    BAJO = 0
    MEDIO = 1
    ALTO = 2


# ----------------------------------------------------------------------------
# Reglas calibrables (S3)
# ----------------------------------------------------------------------------
_CAMPOS_DESV = ("fc", "pas", "fr", "temp", "spo2")
_DESV_DEFAULT = {
    "fc": (15.0, 30.0),
    "pas": (15.0, 30.0),
    "fr": (4.0, 8.0),
    "temp": (0.8, 1.5),
    "spo2": (3.0, 5.0),
}

RANGOS_SIGNOS = {
    "fr": (0, 70), "spo2": (50, 100), "pas": (40, 300),
    "fc": (0, 300), "temp": (25, 45), "co2_mmhg": (0, 100),
}
FASES_CICLO = ("menstrual", "folicular", "ovulacion", "lutea")
FASES_MISION = ("vuelo", "regreso_gravedad", "eva", "superficie")


def _numero_regla(campo, valor, minimo, maximo):
    if (isinstance(valor, bool) or not isinstance(valor, (int, float))
            or not isfinite(valor) or not minimo <= valor <= maximo):
        raise ValueError(f"{campo}: numero finito entre {minimo} y {maximo} requerido")


def _entero_regla(campo, valor, minimo, maximo):
    if type(valor) is not int or not minimo <= valor <= maximo:
        raise ValueError(f"{campo}: entero entre {minimo} y {maximo} requerido")


def _normalizar_desv(valor):
    if isinstance(valor, dict):
        if set(valor) != set(_CAMPOS_DESV):
            raise ValueError("desv: claves invalidas")
        pares = [(campo, valor[campo]) for campo in _CAMPOS_DESV]
    else:
        try:
            pares = list(valor)
        except TypeError as exc:
            raise ValueError("desv: se requiere un mapa de campos") from exc
        if len(pares) != len(_CAMPOS_DESV):
            raise ValueError("desv: claves invalidas")
        vistos = set()
        for par in pares:
            if not isinstance(par, (list, tuple)) or len(par) != 2:
                raise ValueError("desv: claves invalidas")
            campo = par[0]
            if campo not in _CAMPOS_DESV or campo in vistos:
                raise ValueError("desv: claves invalidas")
            vistos.add(campo)
        if vistos != set(_CAMPOS_DESV):
            raise ValueError("desv: claves invalidas")
    normalizado = []
    for campo, margen in pares:
        if not isinstance(margen, (list, tuple)) or len(margen) != 2:
            raise ValueError("desv: se requiere 0 < medio < alto")
        medio, alto = margen
        if (isinstance(medio, bool) or isinstance(alto, bool)
                or not isinstance(medio, (int, float))
                or not isinstance(alto, (int, float))
                or not isfinite(medio) or not isfinite(alto)
                or not 0 < medio < alto):
            raise ValueError("desv: se requiere 0 < medio < alto")
        normalizado.append((campo, (float(medio), float(alto))))
    return tuple(normalizado)


@dataclass(frozen=True)
class Reglas:
    """Configuracion calibrable del motor; los valores por defecto son S3."""

    desv: tuple = field(default_factory=lambda: tuple(
        (campo, _DESV_DEFAULT[campo]) for campo in _CAMPOS_DESV))
    fc_regreso_gravedad: float = 6
    mult_pas_mujer_regreso: float = 0.8
    mult_esfuerzo: float = 1.5
    carga_min: float = 0.8
    carga_max: float = 1.25
    temp_lutea: float = 0.4
    mult_fc_lutea: float = 1.2
    co2_aviso: float = 2
    co2_medio: float = 4
    co2_alto: float = 5.3
    co2_critico: float = 10
    persistencia_desviacion: int = 2
    min_muestras_base: int = 5
    min_muestras_fase: int = 3
    horas_sin_medicion: float = 12
    tendencia_ventana: int = 6
    tendencia_pendiente: float = 0.5
    masa_cambio_recalcular: float = 0.05

    def __post_init__(self):
        object.__setattr__(self, "desv", _normalizar_desv(self.desv))
        self.validar()

    def validar(self):
        for campo, margen in _normalizar_desv(self.desv):
            if campo not in _CAMPOS_DESV:
                raise ValueError("desv: claves invalidas")
            medio, alto = margen
            if not 0 < medio < alto:
                raise ValueError("desv: se requiere 0 < medio < alto")
        _numero_regla("fc_regreso_gravedad", self.fc_regreso_gravedad, 0, 30)
        _numero_regla("mult_pas_mujer_regreso", self.mult_pas_mujer_regreso, 0.3, 1)
        _numero_regla("mult_esfuerzo", self.mult_esfuerzo, 1, 3)
        _numero_regla("carga_min", self.carga_min, 0.5, 1)
        _numero_regla("carga_max", self.carga_max, 1, 2)
        _numero_regla("temp_lutea", self.temp_lutea, 0, 1)
        _numero_regla("mult_fc_lutea", self.mult_fc_lutea, 1, 2)
        _numero_regla("co2_aviso", self.co2_aviso, 0, 10)
        _numero_regla("co2_medio", self.co2_medio, 0, 20)
        _numero_regla("co2_alto", self.co2_alto, 0, 30)
        _numero_regla("co2_critico", self.co2_critico, 0, 100)
        _entero_regla("persistencia_desviacion", self.persistencia_desviacion, 1, 10)
        _entero_regla("min_muestras_base", self.min_muestras_base, 3, 100)
        _entero_regla("min_muestras_fase", self.min_muestras_fase, 2, 50)
        _numero_regla("horas_sin_medicion", self.horas_sin_medicion, 1, 168)
        _entero_regla("tendencia_ventana", self.tendencia_ventana, 3, 50)
        _numero_regla("tendencia_pendiente", self.tendencia_pendiente, 0.05, 5)
        _numero_regla("masa_cambio_recalcular", self.masa_cambio_recalcular, 0.01, 0.5)
        if not self.co2_aviso < self.co2_medio < self.co2_alto < self.co2_critico:
            raise ValueError(
                "co2_aviso, co2_medio, co2_alto y co2_critico: orden estricto requerido")
        if self.carga_min > self.carga_max:
            raise ValueError("carga_min no puede superar carga_max")
        return self

    def a_dict(self):
        datos = {campo.name: getattr(self, campo.name) for campo in fields(self)}
        datos["desv"] = {campo: list(margen) for campo, margen in self.desv}
        return datos

    @classmethod
    def desde_dict(cls, datos):
        if not isinstance(datos, dict):
            raise ValueError("configuracion de reglas: objeto requerido")
        permitidos = {campo.name for campo in fields(cls)}
        desconocidos = set(datos) - permitidos
        if desconocidos:
            raise ValueError("configuracion de reglas: campos desconocidos: "
                             + ", ".join(sorted(desconocidos)))
        try:
            return cls(**datos)
        except TypeError as exc:
            raise ValueError("configuracion de reglas invalida") from exc


REGLAS_DEFAULT = Reglas()
DESV = {campo: tuple(margen) for campo, margen in REGLAS_DEFAULT.desv}


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

    def __post_init__(self):
        validacion.perfil(self)


@dataclass
class Ambiente:
    fase: str = "vuelo"                    # "vuelo" | "regreso_gravedad" | "eva" | "superficie"
    co2_mmhg: Optional[float] = None       # presion parcial de CO2 de cabina
    ejercicio: bool = False

    def __post_init__(self):
        validacion.opcion("fase", self.fase, ("vuelo", "regreso_gravedad", "eva", "superficie"))
        if self.co2_mmhg is not None:
            validacion.numero("co2_mmhg", self.co2_mmhg)
        validacion.booleano("ejercicio", self.ejercicio)


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

    def __post_init__(self):
        validacion.signos(self)
        validacion.opcion("conciencia", self.conciencia, ("alerta", "confuso", "voz", "dolor", "inconsciente"))
        validacion.booleano("oxigeno_suplementario", self.oxigeno_suplementario)
        validacion.booleano("hipercapnico", self.hipercapnico)


@dataclass
class LineaBase:
    fc: float
    pas: float
    fr: float
    temp: float
    spo2: float

    def __post_init__(self):
        validacion.signos(self)


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
# Contrato de captura (S4) y compatibilidad con la configuracion historica
# ----------------------------------------------------------------------------
def validar_entradas(perfil, signos, ambiente) -> None:
    """Valida perfil, signos y ambiente con los rangos publicos de S4.

    Es mas estricta que la validacion historica de los dataclasses: evaluar la
    aplica siempre para que los limites nuevos manden aunque el objeto se haya
    construido antes con un rango mas amplio.
    """
    validacion.opcion("sexo", perfil.sexo, ("F", "M"))
    _numero_regla("estatura_m", perfil.estatura_m, 1.2, 2.2)
    _numero_regla("masa_kg", perfil.masa_kg, 30, 200)
    if type(perfil.edad) is not int or not 18 <= perfil.edad <= 80:
        raise ValueError("edad: entero entre 18 y 80 requerido")
    validacion.opcion("ciclo", perfil.ciclo, ("natural", "suprimido", "no_aplica"))
    validacion.opcion("fase_ciclo", perfil.fase_ciclo, (None, *FASES_CICLO))
    if ((perfil.ciclo != "natural" and perfil.fase_ciclo is not None)
            or (perfil.sexo != "F" and perfil.ciclo != "no_aplica")):
        raise ValueError("ciclo/fase incompatibles con el perfil")

    for campo in ("fr", "spo2", "pas", "fc", "temp"):
        _numero_regla(campo, getattr(signos, campo), *RANGOS_SIGNOS[campo])
    validacion.opcion("conciencia", signos.conciencia,
                      ("alerta", "confuso", "voz", "dolor", "inconsciente"))
    if type(signos.oxigeno_suplementario) is not bool:
        raise ValueError("oxigeno_suplementario: booleano requerido")
    if type(signos.hipercapnico) is not bool:
        raise ValueError("hipercapnico: booleano requerido")

    validacion.opcion("fase", ambiente.fase, FASES_MISION)
    if ambiente.co2_mmhg is not None:
        _numero_regla("co2_mmhg", ambiente.co2_mmhg, *RANGOS_SIGNOS["co2_mmhg"])
    if type(ambiente.ejercicio) is not bool:
        raise ValueError("ejercicio: booleano requerido")


def _validar_base(base) -> None:
    for campo in _CAMPOS_DESV:
        _numero_regla(campo, getattr(base, campo), *RANGOS_SIGNOS[campo])


_LEGADO_A_NUEVO = {
    "desviaciones": "desv",
    "offset_fc_regreso": "fc_regreso_gravedad",
    "offset_temp_lutea": "temp_lutea",
    "mult_pas_mujer": "mult_pas_mujer_regreso",
    "mult_esfuerzo": "mult_esfuerzo",
    "mult_fc_lutea": "mult_fc_lutea",
    "metabolismo_min": "carga_min",
    "metabolismo_max": "carga_max",
    "min_muestras": "min_muestras_base",
    "ausencia_horas": "horas_sin_medicion",
    "lecturas_consecutivas": "persistencia_desviacion",
}


def _normalizar_reglas(reglas) -> Reglas:
    """Acepta la Reglas nueva o la congelada de reglas.py (via snapshot())."""
    if reglas is None:
        return REGLAS_DEFAULT
    if isinstance(reglas, Reglas):
        return reglas.validar()
    if isinstance(reglas, dict):
        raise TypeError("reglas: se requiere Reglas o una configuracion compatible, "
                        "no un diccionario")
    instantanea = getattr(reglas, "snapshot", None)
    if not callable(instantanea):
        raise TypeError("reglas: se requiere Reglas o una configuracion compatible")
    datos = instantanea()
    if not isinstance(datos, dict):
        raise TypeError("reglas: snapshot debe ser un objeto")
    convertidas = REGLAS_DEFAULT.a_dict()
    for origen, destino in _LEGADO_A_NUEVO.items():
        if origen in datos:
            convertidas[destino] = datos[origen]
    return Reglas.desde_dict(convertidas)


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
    s.__post_init__()
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
    validacion.perfil(p)
    cm = p.estatura_m * 100
    if p.sexo == "F":
        return 447.593 + 9.247 * p.masa_kg + 3.098 * cm - 4.330 * p.edad
    return 88.362 + 13.397 * p.masa_kg + 4.799 * cm - 5.677 * p.edad


_BEE_REF = 88.362 + 13.397 * 70 + 4.799 * 170 - 5.677 * 40   # referencia: 1.70 m, 70 kg, 40 anos


def carga_metabolica_rel(p: Perfil, reglas: Optional[Reglas] = None) -> float:
    """Gasto basal relativo a la referencia, acotado por Reglas [CALIBRAR]."""
    r = _normalizar_reglas(reglas)
    return min(r.carga_max, max(r.carga_min, gasto_basal(p) / _BEE_REF))


# ----------------------------------------------------------------------------
# Capa 2: desviacion vs linea base personal
# ----------------------------------------------------------------------------
def _contexto(p: Perfil, a: Ambiente, base_de_fase: bool, reglas=None):
    """Devuelve (offsets esperados, multiplicadores de margen, notas).
    mult > 1 = mas tolerancia; mult < 1 = mas sensibilidad."""
    r = _normalizar_reglas(reglas)
    off = {k: 0.0 for k, _ in r.desv}
    mult = {k: 1.0 for k in off}
    notas: list[str] = []

    if a.fase == "regreso_gravedad":
        off["fc"] += r.fc_regreso_gravedad
        notas.append(f"Regreso a gravedad: se espera FC ~+{r.fc_regreso_gravedad:g} lpm y menor respuesta del barorreflejo.")
        if p.sexo == "F":
            mult["pas"] *= r.mult_pas_mujer_regreso
            notas.append("Mayor sensibilidad a caida de PAS (ortostatismo mas frecuente en mujeres).")

    if a.ejercicio or a.fase == "eva":
        k = carga_metabolica_rel(p, r)
        for par in ("fc", "fr"):
            mult[par] *= r.mult_esfuerzo * k
        notas.append(f"Esfuerzo/EVA: margenes de FC y FR ampliados (carga metabolica relativa {k:.2f}).")

    if p.sexo == "F" and p.ciclo == "suprimido":
        notas.append("Ciclo suprimido con anticoncepcion hormonal: sin ajuste por fase. "
                     "Vigilar dolor/hinchazon de pierna o disnea subita (riesgo de TVP/TEP no caracterizado en vuelo).")
    elif p.sexo == "F" and p.ciclo == "natural":
        if p.fase_ciclo == "lutea" and not base_de_fase:
            off["temp"] += r.temp_lutea
            mult["fc"] *= r.mult_fc_lutea
            notas.append(f"Fase lutea: temperatura esperada +{r.temp_lutea:g} C y margen de FC ampliado.")
        if p.fase_ciclo in ("menstrual", "folicular") and a.fase == "regreso_gravedad":
            notas.append("Fase menstrual/folicular temprana: vigilar mareo al ponerse de pie "
                         "(evidencia mixta; la linea base personal manda).")
    return off, mult, notas


def _nivel_desviacion(s: Signos, base: LineaBase, off: dict, mult: dict, reglas=None):
    desv = dict(_normalizar_reglas(reglas).desv)
    actual = {"fc": s.fc, "pas": s.pas, "fr": s.fr, "temp": s.temp, "spo2": s.spo2}
    esperado = {k: getattr(base, k) + off[k] for k in actual}
    nivel, alertas = Riesgo.BAJO, []
    for par, valor in actual.items():
        delta = valor - esperado[par]
        if par == "spo2":
            delta = abs(min(delta, 0.0))          # solo importan las caidas
        else:
            delta = abs(delta)
        medio, alto = (m * mult[par] for m in desv[par])
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
def _nivel_co2(co2: Optional[float], reglas=None):
    r = _normalizar_reglas(reglas)
    if co2 is None:
        return Riesgo.BAJO, [], []
    if co2 >= r.co2_critico:
        return Riesgo.ALTO, [f"CO2 >= {r.co2_critico:g} mmHg: supera el SMAC de 24 h"], []
    if co2 >= r.co2_alto:
        return Riesgo.ALTO, [f"CO2 >= {r.co2_alto:g} mmHg: supera el SMAC de 7-180 dias"], []
    if co2 >= r.co2_medio:
        return Riesgo.MEDIO, [f"CO2 >= {r.co2_medio:g} mmHg: supera la regla de vuelo de la ISS"], []
    if co2 >= r.co2_aviso:
        return Riesgo.BAJO, [], [f"CO2 >= {r.co2_aviso:g} mmHg: posible cefalea, letargo o menor rendimiento cognitivo "
                                 "aun bajo el limite."]
    return Riesgo.BAJO, [], []


# ----------------------------------------------------------------------------
# Funcion principal
# ----------------------------------------------------------------------------
def evaluar(perfil: Perfil, signos: Signos, ambiente: Ambiente,
             base: Optional[LineaBase] = None,
             base_por_fase: Optional[dict] = None,
             *, complementarios: Optional[DatosComplementarios] = None,
             reglas: Optional[Reglas] = None) -> Resultado:
    """base: linea base personal preflight.
    base_por_fase: opcional {"lutea": LineaBase, ...}; si existe para la fase actual,
    reemplaza a `base` y evita los ajustes genericos de ciclo.
    complementarios: evidencia opcional para cribado, separado del nivel agudo.
    Sin datos, las condiciones complementarias quedan no evaluables."""
    perfil.__post_init__()
    ambiente.__post_init__()
    validar_entradas(perfil, signos, ambiente)
    if base is not None:
        base.__post_init__()
        _validar_base(base)
    if base_por_fase is not None:
        for fase, valor in base_por_fase.items():
            validacion.opcion("base_por_fase", fase, FASES_CICLO)
            valor.__post_init__()
            _validar_base(valor)
    reglas = _normalizar_reglas(reglas)
    total, desglose = news2(signos)
    n_news2 = _nivel_news2(total, desglose)

    usa_base_fase = bool(base_por_fase and perfil.fase_ciclo in base_por_fase
                         and perfil.ciclo == "natural")
    if usa_base_fase:
        base = base_por_fase[perfil.fase_ciclo]

    off, mult, notas = _contexto(perfil, ambiente, usa_base_fase, reglas)
    alertas: list[str] = []

    if base is None:
        n_desv = Riesgo.BAJO
        notas.append("Sin linea base personal: se evalua solo con NEWS2 y ambiente.")
    else:
        n_desv, a_desv = _nivel_desviacion(signos, base, off, mult, reglas)
        alertas += a_desv

    n_co2, a_co2, n_co2_notas = _nivel_co2(ambiente.co2_mmhg, reglas)
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
