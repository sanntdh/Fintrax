"""Persistencia transaccional; JSON clinico cifrado y permisos de asignacion."""
from dataclasses import dataclass
from hashlib import sha256
import hmac
import json
from uuid import uuid4

from cryptography.fernet import Fernet
from sqlalchemy import (Boolean, CheckConstraint, Column, Float, ForeignKey, Index,
                        Integer, MetaData, String, Table, Text, UniqueConstraint,
                        create_engine, event, func, inspect, select)

metadata = MetaData()


def tabla(nombre, *columnas, **kw):
    return Table(nombre, metadata, Column("id", String(64), primary_key=True), *columnas, **kw)


astronauta = tabla("astronauta", Column("creado", Float, nullable=False),
                   Column("perfil_actual", String(64)))
perfil = tabla("perfil", Column("astronauta_id", ForeignKey("astronauta.id"), nullable=False),
               Column("datos", Text, nullable=False), Column("creado", Float, nullable=False))
linea_base = tabla("linea_base", Column("astronauta_id", ForeignKey("astronauta.id"), nullable=False),
                   Column("perfil_id", ForeignKey("perfil.id"), nullable=False),
                   Column("reglas_hash", String(64), nullable=False), Column("fase", String(64), nullable=False),
                   Column("datos", Text, nullable=False), Column("creado", Float, nullable=False))
medicion = tabla("medicion", Column("astronauta_id", ForeignKey("astronauta.id"), nullable=False),
                 Column("perfil_id", ForeignKey("perfil.id"), nullable=False),
                 Column("timestamp", Float, nullable=False), Column("preflight", Boolean, nullable=False),
                 Column("datos", Text, nullable=False), UniqueConstraint("astronauta_id", "timestamp"))
regla = tabla("regla", Column("version", String(64), nullable=False, unique=True),
              Column("datos", Text, nullable=False))
evaluacion = tabla("evaluacion", Column("astronauta_id", ForeignKey("astronauta.id"), nullable=False),
                   Column("medicion_id", ForeignKey("medicion.id"), nullable=False, unique=True),
                   Column("timestamp", Float, nullable=False), Column("datos", Text, nullable=False))
alerta = tabla("alerta", Column("astronauta_id", ForeignKey("astronauta.id"), nullable=False),
               Column("tipo", String(30), nullable=False), Column("destinatario", String(30), nullable=False),
               Column("estado", String(20), nullable=False), Column("creado", Float, nullable=False),
               Column("datos", Text, nullable=False),
               CheckConstraint("estado IN ('nuevo','reconocido','resuelto')"),
               CheckConstraint("destinatario IN ('astronauta','oficial_medico','tierra')"))
Index("alerta_activa_unica", alerta.c.astronauta_id, alerta.c.tipo, alerta.c.destinatario,
      unique=True, sqlite_where=alerta.c.estado != "resuelto", postgresql_where=alerta.c.estado != "resuelto")
evento_alerta = tabla("evento_alerta", Column("alerta_id", ForeignKey("alerta.id"), nullable=False),
                      Column("actor", String(64), nullable=False), Column("estado", String(20), nullable=False),
                      Column("timestamp", Float, nullable=False), Column("secuencia", Integer, nullable=False),
                      UniqueConstraint("alerta_id", "secuencia"))
identidad = tabla("identidad", Column("rol", String(30), nullable=False),
                  CheckConstraint("rol IN ('astronauta','oficial_medico','tierra')"))
asignacion = tabla("asignacion", Column("actor", ForeignKey("identidad.id"), nullable=False),
                   Column("astronauta_id", ForeignKey("astronauta.id"), nullable=False),
                   UniqueConstraint("actor", "astronauta_id"))
auditoria = tabla("auditoria", Column("actor", String(64)), Column("recurso", String(64)),
                  Column("accion", String(50), nullable=False), Column("resultado", String(20), nullable=False),
                  Column("timestamp", Float, nullable=False))
esquema = tabla("esquema")


def uid():
    return str(uuid4())


class ErrorServicio(Exception):
    def __init__(self, estado, mensaje):
        self.estado, self.mensaje = estado, mensaje


@dataclass(frozen=True)
class Principal:
    actor: str
    rol: str


class Almacen:
    def __init__(self, url, clave, emisor):
        self.cifrado = Fernet(clave.encode())
        self.clave_identidad = sha256(("identidad:" + emisor + ":" + clave).encode()).digest()
        self.engine = create_engine(url, echo=False, hide_parameters=True, pool_pre_ping=True)
        if self.engine.dialect.name == "sqlite":
            @event.listens_for(self.engine, "connect")
            def sqlite_config(dbapi, _):
                dbapi.isolation_level = None
                dbapi.execute("PRAGMA foreign_keys=ON")

            @event.listens_for(self.engine, "begin")
            def sqlite_begin(conexion):
                conexion.exec_driver_sql("BEGIN IMMEDIATE")

    def inicializar(self):
        if inspect(self.engine).get_table_names():
            raise ValueError("inicializar solo admite una base vacia; no migra datos existentes")
        with self.engine.begin() as c:
            metadata.create_all(c)
            c.execute(esquema.insert().values(id="1"))
            if self.engine.dialect.name == "postgresql":
                c.exec_driver_sql("CREATE FUNCTION rechazar_mutacion_bitacora() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'append only'; END; $$")
            for nombre in ("auditoria", "evento_alerta"):
                if self.engine.dialect.name == "sqlite":
                    for operacion in ("UPDATE", "DELETE"):
                        c.exec_driver_sql(f"CREATE TRIGGER {nombre}_{operacion.lower()} BEFORE {operacion} ON {nombre} BEGIN SELECT RAISE(ABORT, 'append only'); END")
                else:
                    c.exec_driver_sql(f"CREATE TRIGGER {nombre}_inmutable BEFORE UPDATE OR DELETE ON {nombre} FOR EACH ROW EXECUTE FUNCTION rechazar_mutacion_bitacora()")

    def comprobar_esquema(self):
        with self.engine.connect() as c:
            if c.execute(select(esquema.c.id)).scalar_one() != "1":
                raise ValueError("version de esquema incompatible")

    def sellar(self, datos):
        return self.cifrado.encrypt(json.dumps(datos, allow_nan=False, sort_keys=True).encode()).decode()

    def abrir(self, datos):
        return json.loads(self.cifrado.decrypt(datos.encode()))

    def actor(self, subject):
        return hmac.new(self.clave_identidad, subject.encode(), sha256).hexdigest()

    def registrar(self, actor, recurso, accion, resultado, ahora, conexion=None):
        valores = dict(id=uid(), actor=actor, recurso=recurso, accion=accion,
                       resultado=resultado, timestamp=ahora.timestamp())
        if conexion is not None:
            conexion.execute(auditoria.insert().values(**valores))
        else:
            with self.engine.begin() as c:
                c.execute(auditoria.insert().values(**valores))

    def principal(self, subject):
        actor = self.actor(subject)
        with self.engine.connect() as c:
            rol = c.execute(select(identidad.c.rol).where(identidad.c.id == actor)).scalar_one_or_none()
        return Principal(actor, rol) if rol else None

    def dar_rol(self, subject, rol):
        if rol not in ("astronauta", "oficial_medico", "tierra") or not subject or len(subject) > 255:
            raise ValueError("identidad/rol invalido")
        with self.engine.begin() as c:
            c.execute(identidad.insert().values(id=self.actor(subject), rol=rol))

    def asignar(self, subject, astronauta_id):
        with self.engine.begin() as c:
            c.execute(asignacion.insert().values(id=uid(), actor=self.actor(subject), astronauta_id=astronauta_id))

    def revocar(self, subject):
        actor = self.actor(subject)
        with self.engine.begin() as c:
            c.execute(asignacion.delete().where(asignacion.c.actor == actor))
            c.execute(identidad.delete().where(identidad.c.id == actor))

    def autorizar(self, principal, astronauta_id, accion, ahora, roles=None):
        with self.engine.begin() as c:
            rol = c.execute(select(identidad.c.rol).where(identidad.c.id == principal.actor)).scalar_one_or_none()
            asignado = (astronauta_id is None or c.execute(select(asignacion.c.id).where(
                asignacion.c.actor == principal.actor,
                asignacion.c.astronauta_id == astronauta_id)).first() is not None)
            permitido = rol == principal.rol and asignado and (roles is None or rol in roles)
            self.registrar(principal.actor, astronauta_id, accion,
                           "permitido" if permitido else "denegado", ahora, c)
        if not permitido:
            raise ErrorServicio(403, "Acceso no autorizado al recurso")

    def bloquear(self, c, astronauta_id):
        fila = c.execute(select(astronauta).where(astronauta.c.id == astronauta_id).with_for_update()).mappings().first()
        if fila is None:
            raise ErrorServicio(404, "Recurso no disponible")
        return fila

    def contar(self, nombre):
        with self.engine.connect() as c:
            return c.execute(select(func.count()).select_from(metadata.tables[nombre])).scalar_one()
