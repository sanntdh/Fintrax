from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StrictBool, model_validator

from parametros import Ambiente, Perfil, Signos
from enfermedades_espaciales import DatosComplementarios, Dosimetria, MedicionComparada

Numero = Annotated[float, Field(strict=True, allow_inf_nan=False)]
Fase = Literal["menstrual", "folicular", "ovulacion", "lutea"]


class Entrada(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, hide_input_in_errors=True)


class PerfilEntrada(Entrada):
    sexo: Literal["F", "M"]
    estatura_m: Annotated[Numero, Field(ge=0.5, le=2.5)]
    masa_kg: Annotated[Numero, Field(ge=2, le=400)]
    edad: Annotated[int, Field(strict=True, ge=18, le=100)]
    ciclo: Literal["natural", "suprimido", "no_aplica"] = "no_aplica"
    fase_ciclo: Fase | None = None
    ultima_menstruacion: date | None = None
    duracion_ciclo: Annotated[int, Field(strict=True, ge=21, le=45)] | None = None

    @model_validator(mode="after")
    def coherencia(self):
        Perfil(**self.model_dump(exclude={"ultima_menstruacion", "duracion_ciclo"}))
        if self.fase_ciclo is not None:
            raise ValueError("fase_ciclo debe declararse en la medicion, no como dato permanente")
        if (self.ultima_menstruacion is None) != (self.duracion_ciclo is None):
            raise ValueError("el calendario requiere fecha y duracion conjuntamente")
        if self.ciclo != "natural" and self.ultima_menstruacion is not None:
            raise ValueError("calendario solo aplicable a ciclo natural")
        return self


class SignosEntrada(Entrada):
    fr: Annotated[Numero, Field(ge=0, le=100)]
    spo2: Annotated[Numero, Field(ge=0, le=100)]
    pas: Annotated[Numero, Field(ge=0, le=300)]
    fc: Annotated[Numero, Field(ge=0, le=300)]
    temp: Annotated[Numero, Field(ge=25, le=45)]
    conciencia: Literal["alerta", "confuso", "voz", "dolor", "inconsciente"] = "alerta"
    oxigeno_suplementario: StrictBool = False
    hipercapnico: StrictBool = False

    def dominio(self):
        return Signos(**self.model_dump())


class AmbienteEntrada(Entrada):
    fase: Literal["vuelo", "regreso_gravedad", "eva", "superficie"] = "vuelo"
    co2_mmhg: Annotated[Numero, Field(ge=0, le=100)] | None = None
    ejercicio: StrictBool = False

    def dominio(self):
        return Ambiente(**self.model_dump())


class MedicionEntrada(Entrada):
    basal: Annotated[Numero, Field(gt=0)] | None = None
    actual: Annotated[Numero, Field(gt=0)] | None = None
    cambio_minimo: Annotated[Numero, Field(ge=0)] | None = None
    comparables: StrictBool | None = None


class DosisEntrada(Entrada):
    dosis_msv: Annotated[Numero, Field(ge=0)] | None = None
    limite_msv: Annotated[Numero, Field(gt=0)] | None = None
    periodo: Annotated[str, Field(min_length=1, max_length=128, pattern=r"\S")] | None = None


class ComplementariosEntrada(Entrada):
    dosimetria: DosisEntrada | None = None
    densidad_osea: MedicionEntrada | None = None
    fuerza_muscular: MedicionEntrada | None = None
    cambio_visual: StrictBool | None = None
    hallazgo_ocular: StrictBool | None = None
    sintomas_al_incorporarse: StrictBool | None = None
    alteracion_sueno: StrictBool | None = None
    alteracion_animo: StrictBool | None = None
    dificultad_cognitiva: StrictBool | None = None
    mareo_desorientacion: StrictBool | None = None
    evaluacion_inmune_anormal: StrictBool | None = None

    def dominio(self):
        datos = self.model_dump()
        for campo, tipo in [("dosimetria", Dosimetria), ("densidad_osea", MedicionComparada),
                            ("fuerza_muscular", MedicionComparada)]:
            if datos[campo] is not None:
                datos[campo] = tipo(**datos[campo])
        return DatosComplementarios(**datos)


class CrearAstronauta(Entrada):
    perfil: PerfilEntrada


class EvaluacionEntrada(Entrada):
    astronauta_id: UUID
    timestamp: AwareDatetime
    signos: SignosEntrada
    ambiente: AmbienteEntrada = Field(default_factory=AmbienteEntrada)
    complementarios: ComplementariosEntrada = Field(default_factory=ComplementariosEntrada)
    fase_ciclo: Fase | None = None
    preflight: StrictBool = False
    reposo: StrictBool = False

    @model_validator(mode="after")
    def muestra_basal(self):
        if self.preflight and (not self.reposo or self.ambiente.ejercicio or self.ambiente.fase == "eva"):
            raise ValueError("muestra preflight requiere reposo sin EVA ni ejercicio")
        return self


class TransicionAlerta(Entrada):
    estado: Literal["reconocido", "resuelto"]


class IdSalida(BaseModel):
    id: UUID
    perfil_id: UUID


class EvaluacionSalida(BaseModel):
    id: UUID
    timestamp: AwareDatetime
    resultado: dict
    temporal: dict
    fase_estimada: dict | None
    linea_base_disponible: bool
    reglas_version: str
    reglas_hash: str
    motor_version: str
    motor_hash: str


class HistorialSalida(BaseModel):
    items: list[EvaluacionSalida]


class AlertasSalida(BaseModel):
    items: list[dict]


class ReproduccionSalida(BaseModel):
    coincide: bool
    resultado: dict
