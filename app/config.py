from dataclasses import dataclass, field
import os
from urllib.parse import urlsplit

from cryptography.fernet import Fernet
from sqlalchemy.engine import make_url


@dataclass(frozen=True)
class Configuracion:
    database_url: str = field(repr=False)
    clave_cifrado: str = field(repr=False)
    oidc_emisor: str
    oidc_audiencia: str
    oidc_jwks: str
    reglas_ruta: str | None = None
    pruebas: bool = False

    def __post_init__(self):
        Fernet(self.clave_cifrado.encode())
        for url in (self.oidc_emisor, self.oidc_jwks):
            p = urlsplit(url)
            if p.scheme != "https" or not p.hostname or p.username or p.password or p.fragment:
                raise ValueError("OIDC requiere URLs HTTPS sin credenciales")
        if not self.oidc_audiencia.strip():
            raise ValueError("OIDC_AUDIENCE requerida")
        if not self.pruebas:
            if not self.database_url.startswith("postgresql+psycopg://"):
                raise ValueError("Produccion requiere PostgreSQL con psycopg")
            if make_url(self.database_url).query.get("sslmode") != "verify-full":
                raise ValueError("Produccion requiere sslmode=verify-full y CA de confianza")

    @classmethod
    def entorno(cls):
        nombres = ("DATABASE_URL", "HEALTH_ENCRYPTION_KEY", "OIDC_ISSUER", "OIDC_AUDIENCE", "OIDC_JWKS_URL")
        if any(not os.environ.get(n) for n in nombres):
            raise ValueError("Falta configuracion obligatoria de base, cifrado o identidad")
        return cls(*(os.environ[n] for n in nombres), reglas_ruta=os.environ.get("HEALTH_RULES_PATH"))
