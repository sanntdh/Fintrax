from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import unittest

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.asymmetric import ec
import jwt

from app.config import Configuracion
from app.seguridad import IdentidadInvalida, VerificadorOIDC


class SeguridadTests(unittest.TestCase):
    def setUp(self):
        self.clave = ec.generate_private_key(ec.SECP256R1())
        self.config = Configuracion("sqlite://", Fernet.generate_key().decode(),
                                    "https://identity.invalid", "health-api",
                                    "https://identity.invalid/jwks", pruebas=True)
        self.verificador = VerificadorOIDC(self.config)
        self.verificador.jwks = SimpleNamespace(get_signing_key_from_jwt=lambda _: SimpleNamespace(key=self.clave.public_key()))
        ahora = datetime.now(timezone.utc)
        self.claims = {"sub": "subject-1", "iss": self.config.oidc_emisor,
                       "aud": self.config.oidc_audiencia, "exp": ahora + timedelta(minutes=5),
                       "iat": ahora}

    def token(self, datos):
        return jwt.encode(datos, self.clave, algorithm="ES256", headers={"kid": "test-key"})

    def test_firma_y_claims_obligatorios(self):
        self.assertEqual(self.verificador(self.token(self.claims)), "subject-1")
        for cambio in [{"iss": "https://otro.invalid"}, {"aud": "otro"}, {"exp": 1},
                       {"sub": ""}, {"iat": True}, {"nbf": 9999999999}]:
            with self.subTest(cambio=cambio):
                with self.assertRaises(IdentidadInvalida):
                    self.verificador(self.token({**self.claims, **cambio}))
        for campo in ("exp", "iat", "iss", "aud", "sub"):
            with self.assertRaises(IdentidadInvalida):
                self.verificador(self.token({k: v for k, v in self.claims.items() if k != campo}))
        ajena = ec.generate_private_key(ec.SECP256R1())
        with self.assertRaises(IdentidadInvalida):
            self.verificador(jwt.encode(self.claims, ajena, algorithm="ES256", headers={"kid": "test-key"}))
        with self.assertRaises(IdentidadInvalida):
            self.verificador(jwt.encode(self.claims, "not-a-production-key" * 2, algorithm="HS256", headers={"kid": "test-key"}))

    def test_servidor_no_admite_sqlite_ni_ssl_suplantado(self):
        for url in ["sqlite://", "postgresql+psycopg://localhost/db?sslmode=disable&x=sslmode=verify-full"]:
            with self.subTest(url=url):
                with self.assertRaises(ValueError):
                    Configuracion(url, self.config.clave_cifrado, self.config.oidc_emisor,
                                  self.config.oidc_audiencia, self.config.oidc_jwks)


if __name__ == "__main__":
    unittest.main()
