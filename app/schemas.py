"""Contratos de entrada del flujo preflight → línea base → misión."""
from datetime import date, datetime, timezone
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, model_validator

from app.db import ahora
from app.esquemas import ComplementariosEntrada
from parametros import RANGOS_SIGNOS, Perfil, Reglas

Numero = Annotated[float, Field(strict=True, allow_inf_nan=False)]
Fase = Literal["menstrual", "folicular", "ovulacion", "lutea"]
Rol = Literal["admin", "medico", "tierra", "astronauta"]


class Entrada(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, hide_input_in_errors=True)


class AstronautaIn(Entrada):
    nombre: str = Field(min_length=1, max_length=120)
    sexo: Literal["F", "M"]
    estatura_m: Annotated[Numero, Field(ge=1.2, le=2.2)]
    masa_kg: Annotated[Numero, Field(ge=30, le=200)]
    edad: Annotated[int, Field(strict=True, ge=18, le=80)]
    ciclo: Literal["natural", "suprimido", "no_aplica"] = "no_aplica"
    ultima_menstruacion: date | None = None
    duracion_ciclo: Annotated[int, Field(strict=True, ge=21, le=45)] = 28
    activo: StrictBool = True

    @model_validator(mode="after")
    def coherencia(self):
        Perfil(self.sexo, self.estatura_m, self.masa_kg, self.edad, self.ciclo)
        if self.sexo == "M" and self.ciclo != "no_aplica":
            raise ValueError("un perfil masculino solo admite ciclo no_aplica")
        if self.ciclo != "natural" and self.ultima_menstruacion is not None:
            raise ValueError("fecha de última menstruación solo corresponde a ciclo natural")
        if self.ultima_menstruacion and self.ultima_menstruacion > ahora().date():
            raise ValueError("la fecha de última menstruación no puede ser futura")
        return self


class AstronautaPatch(Entrada):
    nombre: str | None = Field(default=None, min_length=1, max_length=120)
    sexo: Literal["F", "M"] | None = None
    estatura_m: Annotated[Numero, Field(ge=1.2, le=2.2)] | None = None
    masa_kg: Annotated[Numero, Field(ge=30, le=200)] | None = None
    edad: Annotated[int, Field(strict=True, ge=18, le=80)] | None = None
    ciclo: Literal["natural", "suprimido", "no_aplica"] | None = None
    ultima_menstruacion: date | None = None
    duracion_ciclo: Annotated[int, Field(strict=True, ge=21, le=45)] | None = None
    activo: StrictBool | None = None


def signo(campo):
    bajo, alto = RANGOS_SIGNOS[campo]
    return Field(ge=bajo, le=alto)


class SignosIn(Entrada):
    fr: Numero = signo("fr")
    spo2: Numero = signo("spo2")
    pas: Numero = signo("pas")
    fc: Numero = signo("fc")
    temp: Numero = signo("temp")
    conciencia: Literal["alerta", "confuso", "voz", "dolor", "inconsciente"] = "alerta"
    oxigeno_suplementario: StrictBool = False
    hipercapnico: StrictBool = False


class MedicionIn(Entrada):
    ts: datetime = Field(default_factory=ahora)
    contexto: Literal["preflight", "vuelo", "regreso_gravedad", "eva", "superficie"]
    signos: SignosIn
    co2_mmhg: Annotated[Numero, Field(ge=0, le=100)] | None = None
    ejercicio: StrictBool = False
    masa_kg: Annotated[Numero, Field(ge=30, le=200)] | None = None
    fase_ciclo: Fase | None = None
    complementarios: ComplementariosEntrada | None = None

    @model_validator(mode="after")
    def contexto_valido(self):
        if self.ts.tzinfo is not None:
            self.ts = self.ts.astimezone(timezone.utc).replace(tzinfo=None)
        if self.ts > ahora():
            raise ValueError("ts no puede ser futuro")
        if self.contexto == "preflight" and (self.complementarios is not None or self.ejercicio):
            raise ValueError("preflight requiere reposo y no admite complementarios")
        return self


class ReglasIn(Entrada):
    desv: dict[str, tuple[Numero, Numero]] | None = None
    fc_regreso_gravedad: Numero | None = None
    mult_pas_mujer_regreso: Numero | None = None
    mult_esfuerzo: Numero | None = None
    carga_min: Numero | None = None
    carga_max: Numero | None = None
    temp_lutea: Numero | None = None
    mult_fc_lutea: Numero | None = None
    co2_aviso: Numero | None = None
    co2_medio: Numero | None = None
    co2_alto: Numero | None = None
    co2_critico: Numero | None = None
    persistencia_desviacion: Annotated[int, Field(strict=True)] | None = None
    min_muestras_base: Annotated[int, Field(strict=True)] | None = None
    min_muestras_fase: Annotated[int, Field(strict=True)] | None = None
    horas_sin_medicion: Numero | None = None
    tendencia_ventana: Annotated[int, Field(strict=True)] | None = None
    tendencia_pendiente: Numero | None = None
    masa_cambio_recalcular: Numero | None = None
    motivo: str = Field(default="Calibración [CALIBRAR]", min_length=3, max_length=255)

    @model_validator(mode="after")
    def tipos_y_claves(self):
        cambios = self.model_dump(exclude_unset=True, exclude={"motivo"})
        if any(v is None for v in cambios.values()):
            raise ValueError("las reglas no admiten valores nulos")
        # Rangos y orden se validan tras mezclar con la versión vigente, no con defaults.
        return self


class UsuarioIn(Entrada):
    nombre: str = Field(min_length=1, max_length=120)
    rol: Rol
    astronauta_id: Annotated[int, Field(strict=True, gt=0)] | None = None
    clave: str | None = Field(default=None, min_length=16, max_length=256)

    @model_validator(mode="after")
    def asignacion(self):
        if self.rol == "astronauta" and self.astronauta_id is None:
            raise ValueError("el usuario astronauta requiere astronauta_id")
        return self


class ResolverIn(Entrada):
    nota: str = Field(min_length=3, max_length=500)

    @model_validator(mode="after")
    def no_vacia(self):
        if len(self.nota.strip()) < 3:
            raise ValueError("se requiere una nota de al menos tres caracteres")
        return self
