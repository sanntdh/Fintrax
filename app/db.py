"""Modelo ORM y utilidades de base de datos para el backend de monitoreo."""

from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Engine,
    Float,
    ForeignKey,
    Integer,
    String,
    create_engine,
    event,
    select,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, object_session
from sqlalchemy.pool import StaticPool


def ahora() -> datetime:
    """Hora UTC actual sin zona horaria, como se persiste en el esquema."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    """Base declarativa de SQLAlchemy 2."""


def _es_memoria(url: str) -> bool:
    return url in {"sqlite://", "sqlite:///:memory:"} or ":memory:" in url


def _activar_fk(conexion, _registro) -> None:
    cursor = conexion.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys=ON")
    finally:
        cursor.close()


def crear_engine(url: str) -> Engine:
    """Crea un engine; en SQLite comparte memoria y activa claves foráneas."""
    # Los proveedores (Neon, Render, Railway) dan postgres:// o postgresql:// sin
    # driver; SQLAlchemy usaría psycopg2, que no se instala: se fuerza psycopg 3.
    for prefijo in ("postgresql://", "postgres://"):
        if url.startswith(prefijo):
            url = "postgresql+psycopg://" + url[len(prefijo):]
    opciones: dict[str, Any] = {}
    if url.startswith("sqlite"):
        opciones["connect_args"] = {"check_same_thread": False}
        if _es_memoria(url):
            opciones["poolclass"] = StaticPool
    else:
        # Los PostgreSQL gestionados (Neon) cierran conexiones inactivas: se
        # comprueba cada una antes de usarla y se renueva si ya no sirve.
        opciones["pool_pre_ping"] = True
    motor = create_engine(url, **opciones)
    if url.startswith("sqlite"):
        event.listen(motor, "connect", _activar_fk)
    return motor


class Usuario(Base):
    __tablename__ = "usuario"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    rol: Mapped[str] = mapped_column(String(32), nullable=False)
    astronauta_id: Mapped[int | None] = mapped_column(
        ForeignKey("astronauta.id"), nullable=True
    )
    clave_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    creado: Mapped[datetime] = mapped_column(DateTime, default=ahora, nullable=False)


class Astronauta(Base):
    __tablename__ = "astronauta"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    sexo: Mapped[str] = mapped_column(String(8), nullable=False)
    estatura_m: Mapped[float] = mapped_column(Float, nullable=False)
    masa_kg: Mapped[float] = mapped_column(Float, nullable=False)
    edad: Mapped[int] = mapped_column(Integer, nullable=False)
    ciclo: Mapped[str] = mapped_column(String(32), nullable=False)
    ultima_menstruacion: Mapped[date | None] = mapped_column(Date, nullable=True)
    duracion_ciclo: Mapped[int] = mapped_column(Integer, default=28, nullable=False)
    en_mision: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    creado: Mapped[datetime] = mapped_column(DateTime, default=ahora, nullable=False)


class Medicion(Base):
    __tablename__ = "medicion"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    astronauta_id: Mapped[int] = mapped_column(
        ForeignKey("astronauta.id"), index=True, nullable=False
    )
    ts: Mapped[datetime] = mapped_column(DateTime, index=True, default=ahora, nullable=False)
    contexto: Mapped[str] = mapped_column(String(32), nullable=False)
    fr: Mapped[float] = mapped_column(Float, nullable=False)
    spo2: Mapped[float] = mapped_column(Float, nullable=False)
    pas: Mapped[float] = mapped_column(Float, nullable=False)
    fc: Mapped[float] = mapped_column(Float, nullable=False)
    temp: Mapped[float] = mapped_column(Float, nullable=False)
    conciencia: Mapped[str] = mapped_column(String(32), nullable=False)
    oxigeno_suplementario: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    hipercapnico: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    co2_mmhg: Mapped[float | None] = mapped_column(Float, nullable=True)
    ejercicio: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    fase_ciclo: Mapped[str | None] = mapped_column(String(32), nullable=True)
    masa_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    complementarios: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    creado_por: Mapped[int | None] = mapped_column(ForeignKey("usuario.id"), nullable=True)


class LineaBaseDB(Base):
    __tablename__ = "linea_base"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    astronauta_id: Mapped[int] = mapped_column(ForeignKey("astronauta.id"), nullable=False)
    fase_ciclo: Mapped[str | None] = mapped_column(String(32), nullable=True)
    fc: Mapped[float] = mapped_column(Float, nullable=False)
    pas: Mapped[float] = mapped_column(Float, nullable=False)
    fr: Mapped[float] = mapped_column(Float, nullable=False)
    temp: Mapped[float] = mapped_column(Float, nullable=False)
    spo2: Mapped[float] = mapped_column(Float, nullable=False)
    n_muestras: Mapped[int] = mapped_column(Integer, nullable=False)
    masa_kg: Mapped[float] = mapped_column(Float, nullable=False)
    activa: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    creada: Mapped[datetime] = mapped_column(DateTime, default=ahora, nullable=False)

    def desactualizada_para(self, masa_actual, umbral):
        """Comparación calculada; nunca cambia la vigencia de la referencia."""
        return abs(masa_actual - self.masa_kg) / self.masa_kg >= umbral - 1e-12

    @property
    def desactualizada(self):
        sesion = object_session(self)
        if sesion is None:
            return None  # Sin sesión no se conoce la masa actual ni la política vigente.
        astro = sesion.get(Astronauta, self.astronauta_id)
        version = sesion.scalar(select(ReglasVersion).order_by(ReglasVersion.id.desc()).limit(1))
        from parametros import REGLAS_DEFAULT
        umbral = version.contenido["masa_cambio_recalcular"] if version else REGLAS_DEFAULT.masa_cambio_recalcular
        return self.desactualizada_para(astro.masa_kg, umbral) if astro else None


class ReglasVersion(Base):
    __tablename__ = "reglas_version"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    creada: Mapped[datetime] = mapped_column(DateTime, default=ahora, nullable=False)
    creado_por: Mapped[int | None] = mapped_column(ForeignKey("usuario.id"), nullable=True)
    motivo: Mapped[str] = mapped_column(String(255), nullable=False)
    contenido: Mapped[dict] = mapped_column(JSON, nullable=False)


class Evaluacion(Base):
    __tablename__ = "evaluacion"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    medicion_id: Mapped[int] = mapped_column(
        ForeignKey("medicion.id"), unique=True, nullable=False
    )
    astronauta_id: Mapped[int] = mapped_column(ForeignKey("astronauta.id"), nullable=False)
    ts: Mapped[datetime] = mapped_column(DateTime, default=ahora, nullable=False)
    nivel: Mapped[int] = mapped_column(Integer, nullable=False)
    news2_total: Mapped[int] = mapped_column(Integer, nullable=False)
    resultado: Mapped[dict] = mapped_column(JSON, nullable=False)
    version_reglas: Mapped[int] = mapped_column(ForeignKey("reglas_version.id"), nullable=False)
    entrada: Mapped[dict] = mapped_column(JSON, nullable=False)


class Alerta(Base):
    __tablename__ = "alerta"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    astronauta_id: Mapped[int] = mapped_column(ForeignKey("astronauta.id"), nullable=False)
    evaluacion_id: Mapped[int | None] = mapped_column(
        ForeignKey("evaluacion.id"), nullable=True
    )
    tipo: Mapped[str] = mapped_column(String(64), nullable=False)
    nivel: Mapped[str] = mapped_column(String(16), nullable=False)
    mensaje: Mapped[str] = mapped_column(String(500), nullable=False)
    estado: Mapped[str] = mapped_column(String(16), default="nueva", nullable=False)
    destinatarios: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    ocurrencias: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    creada: Mapped[datetime] = mapped_column(DateTime, default=ahora, nullable=False)
    ultima_ts: Mapped[datetime] = mapped_column(DateTime, default=ahora, nullable=False)


class AlertaEvento(Base):
    __tablename__ = "alerta_evento"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    alerta_id: Mapped[int] = mapped_column(ForeignKey("alerta.id"), nullable=False)
    ts: Mapped[datetime] = mapped_column(DateTime, default=ahora, nullable=False)
    actor: Mapped[str] = mapped_column(String(120), nullable=False)
    rol: Mapped[str] = mapped_column(String(32), nullable=False)
    accion: Mapped[str] = mapped_column(String(64), nullable=False)
    nota: Mapped[str | None] = mapped_column(String(500), nullable=True)


class Auditoria(Base):
    __tablename__ = "auditoria"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=ahora, nullable=False)
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuario.id"), nullable=True)
    actor: Mapped[str] = mapped_column(String(120), nullable=False)
    rol: Mapped[str] = mapped_column(String(32), nullable=False)
    accion: Mapped[str] = mapped_column(String(64), nullable=False)
    recurso: Mapped[str] = mapped_column(String(120), nullable=False)
    # Sin FK: un intento denegado puede referenciar un astronauta inexistente.
    astronauta_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    detalle: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    exito: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
