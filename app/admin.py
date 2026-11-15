"""Operaciones locales privilegiadas. No crea usuarios en el proveedor OIDC."""
import argparse
from datetime import datetime, timezone

from sqlalchemy import select

from app.almacen import Almacen, asignacion
from app.clinica import Clinica
from app.config import Configuracion
from reglas import cargar_reglas


def main():
    parser = argparse.ArgumentParser(description="Administracion local de esquema, permisos y vigilancia")
    sub = parser.add_subparsers(dest="comando", required=True)
    sub.add_parser("init-db", help="Inicializar unicamente una base vacia; requiere cuenta DDL separada")
    grant = sub.add_parser("grant", help="Habilitar sub OIDC con rol local, sin permisos globales a historiales")
    grant.add_argument("--subject", required=True)
    grant.add_argument("--role", required=True, choices=["astronauta", "oficial_medico", "tierra"])
    assign = sub.add_parser("assign", help="Asignar una identidad a un astronauta")
    assign.add_argument("--subject", required=True)
    assign.add_argument("--astronauta", required=True)
    revoke = sub.add_parser("revoke", help="Revocar rol y todas las asignaciones locales")
    revoke.add_argument("--subject", required=True)
    monitor = sub.add_parser("monitor", help="Una pasada de ausencia para asignaciones de una identidad habilitada")
    monitor.add_argument("--subject", required=True)
    args = parser.parse_args()
    cfg = Configuracion.entorno()
    db = Almacen(cfg.database_url, cfg.clave_cifrado, cfg.oidc_emisor)
    ahora = datetime.now(timezone.utc)
    try:
        if args.comando == "init-db":
            db.inicializar()
        else:
            db.comprobar_esquema()
            if args.comando == "grant":
                db.dar_rol(args.subject, args.role)
            elif args.comando == "assign":
                db.asignar(args.subject, args.astronauta)
            elif args.comando == "revoke":
                db.revocar(args.subject)
            else:
                principal = db.principal(args.subject)
                if principal is None or principal.rol not in ("oficial_medico", "tierra"):
                    raise ValueError("monitor requiere identidad habilitada de medicina/tierra")
                servicio = Clinica(db, cargar_reglas(cfg.reglas_ruta))
                with db.engine.connect() as c:
                    ids = c.execute(select(asignacion.c.astronauta_id).where(asignacion.c.actor == principal.actor)).scalars().all()
                for a in ids:
                    servicio.comprobar_ausencia(principal, a, ahora)
        db.registrar("operador_local", None, args.comando, "completado", ahora)
        print("Operacion completada")
    finally:
        db.engine.dispose()


if __name__ == "__main__":
    main()
