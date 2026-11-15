"""Opt-in: solo una instancia PostgreSQL desechable autorizada para pruebas.

Cada caso crea su propio esquema aleatorio y elimina exclusivamente ese esquema.
Nunca apuntar HEALTH_TEST_POSTGRES_URL a una base con datos reales.
"""
from concurrent.futures import ThreadPoolExecutor
import os
from uuid import uuid4
import unittest

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url

from tests import test_api


@unittest.skipUnless(os.environ.get("HEALTH_TEST_POSTGRES_URL"), "PostgreSQL desechable no configurado")
class PostgresTests(test_api.APITests):
    def storage_url(self):
        url = os.environ["HEALTH_TEST_POSTGRES_URL"]
        self.admin_engine = create_engine(url, hide_parameters=True)
        self.addCleanup(self.admin_engine.dispose)
        esquema = "health_test_" + uuid4().hex
        with self.admin_engine.begin() as c:
            c.exec_driver_sql(f"CREATE SCHEMA {esquema}")

        def limpiar():
            with self.admin_engine.begin() as c:
                c.exec_driver_sql(f"DROP SCHEMA {esquema} CASCADE")

        self.addCleanup(limpiar)
        return make_url(url).update_query_dict({"options": f"-csearch_path={esquema}"}).render_as_string(hide_password=False)

    def test_medicion_simultanea_no_se_cuenta_dos_veces(self):
        with ThreadPoolExecutor(max_workers=2) as pool:
            respuestas = list(pool.map(lambda _: self.enviar().status_code, range(2)))
        self.assertEqual(sorted(respuestas), [201, 409])
        self.assertEqual(self.db.contar("medicion"), 1)
        self.assertEqual(self.db.contar("evaluacion"), 1)


if __name__ == "__main__":
    unittest.main()
