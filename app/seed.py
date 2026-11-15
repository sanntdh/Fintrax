"""Datos completamente ficticios. Nunca ejecutar contra una base de personas reales."""
from datetime import timedelta
import json
import os
import secrets

from sqlalchemy import func, inspect, select
from sqlalchemy.orm import sessionmaker

from app.db import Alerta, Astronauta, Base, Evaluacion, Usuario, ahora, crear_engine
from app.schemas import AstronautaIn, MedicionIn
from app.seguridad import hash_clave
from app.servicios import calcular_linea_base, derivar_fase, registrar_medicion, reglas_activas, revisar_sin_medicion


def sembrar(database_url=None):
    engine = crear_engine(database_url or os.getenv("MONITOREO_DB", "sqlite:///monitoreo.db"))
    try:
        tablas = inspect(engine).get_table_names()
        if "medicion" in tablas and "contexto" not in {c["name"] for c in inspect(engine).get_columns("medicion")}:
            raise ValueError("Esquema anterior: use una base vacía diferente")
        Base.metadata.create_all(engine)
        with sessionmaker(engine, expire_on_commit=False)() as db:
            if db.scalar(select(func.count()).select_from(Usuario)) or db.scalar(select(func.count()).select_from(Astronauta)):
                raise ValueError("El seed solo se permite en una base sin usuarios ni astronautas; no sobrescribe datos")
            claves = {nombre: secrets.token_urlsafe(32) for nombre in ("admin", "medico", "tierra", "Ana", "Luis", "Sofía")}
            usuarios = {}
            for rol in ("admin", "medico", "tierra"):
                u = Usuario(nombre=rol, rol=rol, clave_hash=hash_clave(claves[rol]))
                db.add(u)
                usuarios[rol] = u
            db.flush()
            reglas_activas(db)
            hoy = ahora()
            perfiles = [
                {"nombre":"Ana","sexo":"F","estatura_m":1.65,"masa_kg":60,"edad":36,
                 "ciclo":"natural","ultima_menstruacion":hoy.date()-timedelta(days=43),"duracion_ciclo":28},
                {"nombre":"Luis","sexo":"M","estatura_m":1.8,"masa_kg":80,"edad":40},
                {"nombre":"Sofía","sexo":"F","estatura_m":1.7,"masa_kg":65,"edad":34,"ciclo":"suprimido"},
            ]
            ids = {}
            for perfil in perfiles:
                a = Astronauta(**AstronautaIn(**perfil).model_dump())
                db.add(a)
                db.flush()
                ids[a.nombre] = a.id
                db.add(Usuario(nombre=a.nombre, rol="astronauta", astronauta_id=a.id,
                               clave_hash=hash_clave(claves[a.nombre])))
                cantidad = 28 if a.nombre == "Ana" else 5
                for i in range(cantidad):
                    ts = hoy - timedelta(days=45-i if a.nombre == "Ana" else 50-i)
                    fase, _ = derivar_fase(a, ts)
                    temperatura = 37.0 if fase == "lutea" else 36.6
                    datos = MedicionIn(contexto="preflight", ts=ts,
                        signos={"fc":64,"fr":14,"pas":115,"spo2":98,"temp":temperatura})
                    registrar_medicion(db, a, datos, usuarios["medico"])
                calcular_linea_base(db, a)
                if a.nombre == "Luis":
                    for i, (fc, fr, spo2, co2) in enumerate(((64,14,98,1.5),(95,14,98,2),
                            (115,14,98,3),(135,14,98,4),(135,24,98,5),(135,26,95,5.5))):
                        registrar_medicion(db, a, MedicionIn(contexto="vuelo", ts=hoy-timedelta(hours=6-i),
                            signos={"fc":fc,"fr":fr,"pas":115,"spo2":spo2,"temp":36.6}, co2_mmhg=co2), usuarios["medico"])
                else:
                    registrar_medicion(db, a, MedicionIn(contexto="vuelo", ts=hoy-timedelta(hours=1 if a.nombre=="Ana" else 14),
                        signos={"fc":64,"fr":14,"pas":115,"spo2":98,"temp":37 if a.nombre=="Ana" else 36.6}), usuarios["medico"])
            revisar_sin_medicion(db)
            db.commit()
            return {"aviso":"DATOS Y CLAVES DEMO FICTICIOS; no reutilizar en producción",
                    "astronautas":ids, "claves_demo":claves,
                    "evaluaciones":db.scalar(select(func.count()).select_from(Evaluacion)),
                    "alertas":db.scalar(select(func.count()).select_from(Alerta))}
    finally:
        engine.dispose()


def main():
    try:
        print(json.dumps(sembrar(), ensure_ascii=False, indent=2))
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc


if __name__ == "__main__":
    main()
