"""Validacion de access tokens; los roles se consultan solo en la base local."""
import jwt
from jwt import PyJWKClient


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
