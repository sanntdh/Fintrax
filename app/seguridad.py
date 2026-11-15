"""Validacion de access tokens; los roles se consultan solo en la base local."""
import hashlib
from typing import Annotated, Callable, Iterator

import jwt
from fastapi import Depends, Header, HTTPException, Request
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import Auditoria, Usuario


class IdentidadInvalida(Exception):
    pass


class VerificadorOIDC:
    def __init__(self, configuracion):
        self.config = configuracion
        self.jwks = PyJWKClient(configuracion.oidc_jwks, timeout=3, lifespan=300, cache_keys=False)

    def __call__(self, token):
        try:
            cabecera = jwt.get_unverified_header(token)
            if cabecera.get("alg") not in ("RS256", "ES256") or not isinstance(cabecera.get("kid"), str):
                raise IdentidadInvalida()
            clave = self.jwks.get_signing_key_from_jwt(token).key
            datos = jwt.decode(token, clave, algorithms=["RS256", "ES256"],
                               audience=self.config.oidc_audiencia, issuer=self.config.oidc_emisor,
                               options={"require": ["exp", "iat", "iss", "aud", "sub"]})
            if not isinstance(datos["sub"], str) or not datos["sub"].strip() or len(datos["sub"]) > 255:
                raise IdentidadInvalida()
            if any(type(datos[c]) not in (int, float) for c in ("exp", "iat")):
                raise IdentidadInvalida()
            return datos["sub"]
        except (jwt.PyJWTError, ValueError, TypeError, KeyError) as exc:
            raise IdentidadInvalida() from exc


PERMISOS = frozenset({
    "leer", "registrar", "editar", "base", "reconocer", "resolver",
    "usuarios", "reglas", "auditoria",
})

PERMISOS_POR_ROL = {
    "admin": PERMISOS,
    "medico": frozenset({"leer", "registrar", "editar", "base", "reconocer", "resolver"}),
    "tierra": frozenset({"leer", "reconocer"}),
    "astronauta": frozenset({"leer", "registrar", "editar", "reconocer"}),
}


def hash_clave(clave: str) -> str:
    """Hash SHA-256 de una clave; el valor claro nunca se persiste."""
    return hashlib.sha256(clave.encode("utf-8")).hexdigest()


def get_db(request: Request) -> Iterator[Session]:
    """Sesion por peticion; cierra sin confirmar mutaciones automaticamente."""
    sesion = request.app.state.SessionLocal()
    try:
        yield sesion
    finally:
        sesion.close()


def obtener_usuario(
    db: Session = Depends(get_db),
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> Usuario:
    """Resuelve el usuario activo por X-API-Key; 401 sin clave valida."""
    if not x_api_key:
        raise HTTPException(status_code=401, detail="API key requerida")
    usuario = db.scalar(
        select(Usuario).where(
            Usuario.clave_hash == hash_clave(x_api_key),
            Usuario.activo.is_(True),
        )
    )
    if usuario is None:
        raise HTTPException(status_code=401, detail="API key inválida")
    return usuario


def auditar(
    db: Session,
    usuario: Usuario | None,
    accion: str,
    recurso: str,
    astronauta_id: int | None = None,
    detalle: str = "",
    exito: bool = True,
) -> None:
    """Agrega una entrada de auditoria sin confirmar la transaccion."""
    db.add(Auditoria(
        usuario_id=getattr(usuario, "id", None),
        actor=(getattr(usuario, "nombre", None) or "anonimo"),
        rol=(getattr(usuario, "rol", None) or ""),
        accion=accion,
        recurso=recurso,
        astronauta_id=astronauta_id,
        detalle=detalle,
        exito=exito,
    ))


def requiere(permiso: str) -> Callable[..., Usuario]:
    """Dependencia que exige un permiso canonico y audita el acceso."""
    if permiso not in PERMISOS:
        raise ValueError(f"Permiso desconocido: {permiso}")

    def dependencia(
        db: Session = Depends(get_db),
        usuario: Usuario = Depends(obtener_usuario),
    ) -> Usuario:
        permitido = permiso in PERMISOS_POR_ROL.get((usuario.rol or "").lower(), frozenset())
        auditar(db, usuario, "autorizacion", permiso,
                detalle="permitido" if permitido else "denegado", exito=permitido)
        db.commit()
        if not permitido:
            raise HTTPException(status_code=403, detail="Permiso insuficiente")
        return usuario

    return dependencia


def comprobar_acceso(
    db: Session,
    usuario: Usuario,
    astronauta_id: int,
    permiso: str = "leer",
) -> None:
    """Restringe alcance por rol; audita y confirma todo 403 antes de lanzarlo."""
    rol = (usuario.rol or "").lower()
    permitidos = PERMISOS_POR_ROL.get(rol, frozenset())
    if permiso not in permitidos:
        detalle = "denegado por rol"
    elif rol == "astronauta" and usuario.astronauta_id != astronauta_id:
        detalle = "denegado por alcance"
    else:
        return
    auditar(db, usuario, "acceso", permiso, astronauta_id=astronauta_id,
            detalle=detalle, exito=False)
    db.commit()
    raise HTTPException(status_code=403, detail="Acceso no autorizado")
