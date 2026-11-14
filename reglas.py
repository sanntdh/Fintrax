"""Configuracion calibrable con identidad por contenido; NEWS2 no es calibrable."""
from dataclasses import asdict, dataclass
from hashlib import sha256
import json
from math import isfinite
from pathlib import Path

import yaml

MOTOR_VERSION = "clinical-monitor-2.0.0"


@dataclass(frozen=True)
class Reglas:
    version: str
    desviaciones: tuple
    offset_fc_regreso: float
    offset_temp_lutea: float
    mult_pas_mujer: float
    mult_esfuerzo: float
    mult_fc_lutea: float
    metabolismo_min: float
    metabolismo_max: float
    min_muestras: int
    mad_corte: float
    lecturas_consecutivas: int
    ausencia_horas: float
    separacion_max_horas: float
    dias_menstruacion: int
    dias_lutea: int

    @classmethod
    def desde_dict(cls, datos):
        d = dict(datos)
        desv = d.get("desviaciones")
        if not isinstance(desv, dict) or set(desv) != {"fc", "pas", "fr", "temp", "spo2"}:
            raise ValueError("desviaciones: claves invalidas")
        for par in desv.values():
            if (not isinstance(par, (list, tuple)) or len(par) != 2
                    or any(type(v) not in (int, float) or not isfinite(v) for v in par)
                    or not 0 < par[0] < par[1]):
                raise ValueError("desviaciones: se requiere 0 < medio < alto")
        d["desviaciones"] = tuple((k, tuple(v)) for k, v in sorted(desv.items()))
        try:
            r = cls(**d)
        except TypeError as exc:
            raise ValueError("configuracion incompleta o con campos desconocidos") from exc
        if not isinstance(r.version, str) or not r.version.strip():
            raise ValueError("version requerida")
        for campo, valor in asdict(r).items():
            if campo in ("version", "desviaciones"):
                continue
            permite_cero = campo in ("offset_fc_regreso", "offset_temp_lutea")
            if (type(valor) not in (int, float) or not isfinite(valor)
                    or valor < 0 or (valor == 0 and not permite_cero)):
                raise ValueError(f"{campo}: valor fuera de rango de configuracion")
        for campo in ("min_muestras", "lecturas_consecutivas", "dias_menstruacion", "dias_lutea"):
            if type(getattr(r, campo)) is not int:
                raise ValueError(f"{campo}: entero requerido")
        if r.min_muestras < 3 or r.metabolismo_min > r.metabolismo_max:
            raise ValueError("configuracion de muestras/metabolismo invalida")
        if r.dias_menstruacion > 10 or not 7 <= r.dias_lutea <= 18:
            raise ValueError("configuracion del calendario invalida")
        return r

    def snapshot(self):
        d = asdict(self)
        d["desviaciones"] = {k: list(v) for k, v in self.desviaciones}
        return d

    @property
    def huella(self):
        return sha256(json.dumps(self.snapshot(), sort_keys=True, allow_nan=False).encode()).hexdigest()


def cargar_reglas(ruta=None):
    ruta = Path(ruta) if ruta else Path(__file__).with_name("reglas.yaml")
    with ruta.open(encoding="utf-8") as archivo:
        datos = yaml.safe_load(archivo)
    if not isinstance(datos, dict):
        raise ValueError("configuracion YAML debe ser un objeto")
    return Reglas.desde_dict(datos)
