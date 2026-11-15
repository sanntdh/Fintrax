from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.config import Configuracion
from app.main import crear_app
from app.almacen import auditoria, medicion, perfil


class APITests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="health-api-test-")
        self.addCleanup(self.tmp.cleanup)
        self.ahora = datetime(2026, 11, 14, 12, tzinfo=timezone.utc)
        self.config = Configuracion(self.storage_url(),
                                    Fernet.generate_key().decode(),
                                    "https://identity.invalid", "health-api",
                                    "https://identity.invalid/jwks", pruebas=True)
        self.app = crear_app(self.config, verificador=lambda token: token,
                             reloj=lambda: self.ahora)
        self.db = self.app.state.almacen
        self.db.inicializar()
        self.db.dar_rol("med", "oficial_medico")
        self.db.dar_rol("astro", "astronauta")
        self.db.dar_rol("ground", "tierra")
        self.db.dar_rol("other", "astronauta")
        self.client = TestClient(self.app)
        self.addCleanup(self.client.close)
        self.addCleanup(self.db.engine.dispose)
        self.perfil = {"sexo": "F", "estatura_m": 1.65, "masa_kg": 60,
                       "edad": 36, "ciclo": "natural", "ultima_menstruacion": "2026-11-01",
                       "duracion_ciclo": 28}
        creado = self.client.post("/astronautas", json={"perfil": self.perfil}, headers=self.headers())
        self.assertEqual(creado.status_code, 201, creado.text)
        self.id = creado.json()["id"]
        self.db.asignar("astro", self.id)
        self.db.asignar("ground", self.id)

    def storage_url(self):
        return "sqlite:///" + self.tmp.name + "/datos.db"

    def headers(self, token="med"):
        return {"Authorization": "Bearer " + token}

    def dato(self, **extra):
        return {"astronauta_id": self.id, "timestamp": self.ahora.isoformat(),
                "signos": {"fr": 14, "spo2": 98, "pas": 115, "fc": 64, "temp": 36.7},
                "ambiente": {}, **extra}

    def enviar(self, datos=None, token="med"):
        return self.client.post("/evaluaciones", json=datos or self.dato(), headers=self.headers(token))

    def test_validacion_no_persiste_ni_filtra_datos_en_error(self):
        for campo, valor in [("pas", -5), ("fr", "NaN"), ("fc", True), ("spo2", 101)]:
            dato = self.dato()
            dato["signos"][campo] = valor
            r = self.enviar(dato)
            self.assertEqual(r.status_code, 422, r.text)
            self.assertNotIn('"input"', r.text)
        dato = self.dato(ambiente={"fase": "marte"})
        self.assertEqual(self.enviar(dato).status_code, 422)
        p = {**self.perfil, "sexo": "X"}
        self.assertEqual(self.client.put(f"/astronautas/{self.id}/perfil", json=p,
                                         headers=self.headers()).status_code, 422)
        p = {**self.perfil, "ciclo": "suprimido", "fase_ciclo": "lutea"}
        self.assertEqual(self.client.put(f"/astronautas/{self.id}/perfil", json=p,
                                         headers=self.headers()).status_code, 422)
        self.assertEqual(self.db.contar("medicion"), 0)
        self.assertEqual(self.db.contar("evaluacion"), 0)

    def test_historial_autorizacion_auditoria_y_cifrado(self):
        self.assertEqual(self.client.get(f"/astronautas/{self.id}/historial").status_code, 401)
        self.assertEqual(self.client.get(f"/astronautas/{self.id}/historial",
                                         headers=self.headers("other")).status_code, 403)
        r = self.enviar(token="astro")
        self.assertEqual(r.status_code, 201, r.text)
        historial = self.client.get(f"/astronautas/{self.id}/historial", headers=self.headers("astro"))
        self.assertEqual(len(historial.json()["items"]), 1)
        self.assertNotIn("ultima_menstruacion", historial.text)
        self.assertEqual(r.json()["reglas_version"], "1.0.0")
        self.assertEqual(len(r.json()["reglas_hash"]), 64)
        self.assertGreaterEqual(self.db.contar("auditoria"), 4)
        with self.db.engine.connect() as c:
            for tabla in (perfil, medicion):
                cifrado = c.execute(select(tabla.c.datos)).scalar_one()
                self.assertNotIn("ultima_menstruacion", cifrado)
                self.assertNotIn('"fr"', cifrado)
                self.assertTrue(self.db.abrir(cifrado))
        if self.db.engine.dialect.name == "sqlite":
            contenido = Path(self.tmp.name, "datos.db").read_bytes()
            self.assertNotIn(b"2026-11-01", contenido)
            self.assertNotIn(b'"masa_kg"', contenido)

    def test_mediana_por_fase_cambio_peso_y_reproduccion(self):
        for i in range(5):
            self.ahora += timedelta(minutes=1)
            r = self.enviar(self.dato(preflight=True, reposo=True, fase_ciclo="lutea"))
            self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(self.db.contar("linea_base"), 2)
        self.ahora += timedelta(minutes=1)
        r = self.enviar(self.dato(fase_ciclo="lutea")).json()
        self.assertTrue(r["linea_base_disponible"])
        reproducido = self.client.post(f'/evaluaciones/{r["id"]}/reproducir', headers=self.headers())
        self.assertEqual(reproducido.status_code, 200, reproducido.text)
        self.assertTrue(reproducido.json()["coincide"])
        nuevo = {**self.perfil, "masa_kg": 58}
        r = self.client.put(f"/astronautas/{self.id}/perfil", json=nuevo, headers=self.headers())
        self.assertEqual(r.status_code, 200, r.text)
        self.ahora += timedelta(minutes=1)
        r = self.enviar().json()
        self.assertFalse(r["linea_base_disponible"])

    def test_alerta_urgente_transiciones_y_destinatario(self):
        dato = self.dato()
        dato["signos"]["pas"] = 90  # un parametro en 3: nunca esperar N lecturas
        r = self.enviar(dato)
        self.assertEqual(r.status_code, 201, r.text)
        self.assertTrue(r.json()["temporal"]["emitir"])
        alertas = self.client.get(f"/astronautas/{self.id}/alertas", headers=self.headers()).json()["items"]
        self.assertEqual(len(alertas), 3)
        alerta = next(a for a in alertas if a["destinatario"] == "oficial_medico")
        url = f'/alertas/{alerta["id"]}'
        self.assertEqual(self.client.patch(url, json={"estado": "reconocido"}, headers=self.headers("astro")).status_code, 403)
        self.assertEqual(self.client.patch(url, json={"estado": "resuelto"}, headers=self.headers()).status_code, 409)
        self.assertEqual(self.client.patch(url, json={"estado": "reconocido"}, headers=self.headers()).status_code, 200)
        self.assertEqual(self.client.patch(url, json={"estado": "resuelto"}, headers=self.headers()).status_code, 200)
        eventos = self.client.get(f"/astronautas/{self.id}/alertas", headers=self.headers()).json()["items"]
        alerta = next(a for a in eventos if a["id"] == alerta["id"])
        self.assertEqual([e["estado"] for e in alerta["eventos"]], ["nuevo", "reconocido", "resuelto"])
        self.assertTrue(alerta["eventos"][-1]["actor"])

    def test_consecutivas_ausencia_orden_y_sin_duplicados(self):
        for i in range(3):
            self.ahora += timedelta(minutes=1)
            r = self.enviar(self.dato(ambiente={"co2_mmhg": 4})).json()
            self.assertEqual(r["temporal"]["emitir"], i == 2)
        self.assertEqual(self.db.contar("alerta"), 3)
        self.ahora += timedelta(minutes=1)
        self.enviar(self.dato(ambiente={"co2_mmhg": 4}))
        self.assertEqual(self.db.contar("alerta"), 3)
        self.assertEqual(self.enviar().status_code, 409)  # mismo timestamp no cuenta dos veces
        self.ahora += timedelta(hours=7)
        url = f"/astronautas/{self.id}/comprobar-ausencia"
        self.assertEqual(self.client.post(url, headers=self.headers()).status_code, 200)
        self.assertEqual(self.db.contar("alerta"), 6)
        self.client.post(url, headers=self.headers())
        self.assertEqual(self.db.contar("alerta"), 6)

    def test_calendario_no_se_confunde_con_fase_confirmada(self):
        r = self.enviar().json()
        self.assertTrue(r["fase_estimada"]["estimada"])
        self.assertFalse(any("Fase lutea:" in n for n in r["resultado"]["notas"]))
        self.ahora += timedelta(minutes=1)
        r = self.enviar(self.dato(fase_ciclo="lutea")).json()
        self.assertTrue(any("Fase lutea:" in n for n in r["resultado"]["notas"]))

    def test_rollback_atomico_de_medicion_evaluacion_y_alertas(self):
        sellar = self.db.sellar

        def fallo(datos):
            if "salida" in datos:
                raise SQLAlchemyError("synthetic failure with private contents")
            return sellar(datos)

        with patch.object(self.db, "sellar", side_effect=fallo):
            respuesta = self.enviar()
        self.assertEqual(respuesta.status_code, 503, respuesta.text)
        self.assertNotIn("private contents", respuesta.text)
        for tabla in ("medicion", "evaluacion", "alerta", "regla"):
            self.assertEqual(self.db.contar(tabla), 0)

    def test_nan_json_crudo_y_campos_extra(self):
        import json
        dato = self.dato()
        dato["signos"]["fr"] = float("nan")
        r = self.client.post("/evaluaciones", content=json.dumps(dato),
                             headers={**self.headers(), "Content-Type": "application/json"})
        self.assertEqual(r.status_code, 422, r.text)
        self.assertNotIn("NaN", r.text)
        r = self.enviar(self.dato(rol="oficial_medico"))
        self.assertEqual(r.status_code, 422)
        self.assertEqual(self.db.contar("medicion"), 0)

    def test_revocacion_e_inmutabilidad_de_bitacora(self):
        self.db.revocar("astro")
        self.assertEqual(self.enviar(token="astro").status_code, 401)
        with self.assertRaises(SQLAlchemyError):
            with self.db.engine.begin() as c:
                c.execute(auditoria.delete())
        with self.db.engine.connect() as c:
            self.assertTrue(c.execute(select(auditoria.c.id)).first())

    def test_mismo_nombre_reglas_no_puede_cambiar_contenido(self):
        import yaml
        self.assertEqual(self.enviar().status_code, 201)
        from reglas import cargar_reglas
        datos = cargar_reglas().snapshot()
        datos["offset_temp_lutea"] = 0.5
        ruta = Path(self.tmp.name, "reglas.yaml")
        ruta.write_text(yaml.safe_dump(datos), encoding="utf-8")
        from dataclasses import replace
        cfg = replace(self.config, reglas_ruta=str(ruta))
        segunda = crear_app(cfg, verificador=lambda t: t, reloj=lambda: self.ahora)
        self.addCleanup(segunda.state.almacen.engine.dispose)
        with TestClient(segunda) as cliente:
            self.ahora += timedelta(minutes=1)
            r = cliente.post("/evaluaciones", json=self.dato(), headers=self.headers())
            self.assertEqual(r.status_code, 409, r.text)
        self.assertEqual(self.db.contar("medicion"), 1)

    def test_token_firmado_no_asigna_su_propio_rol(self):
        from types import SimpleNamespace
        from cryptography.hazmat.primitives.asymmetric import ec
        import jwt
        from app.seguridad import VerificadorOIDC
        clave = ec.generate_private_key(ec.SECP256R1())
        verificador = VerificadorOIDC(self.config)
        verificador.jwks = SimpleNamespace(get_signing_key_from_jwt=lambda _: SimpleNamespace(key=clave.public_key()))
        protegido = crear_app(self.config, verificador=verificador, reloj=lambda: self.ahora)
        self.addCleanup(protegido.state.almacen.engine.dispose)
        ahora = datetime.now(timezone.utc)
        datos = {"sub": "other", "iss": self.config.oidc_emisor, "aud": self.config.oidc_audiencia,
                 "iat": ahora, "exp": ahora + timedelta(minutes=1),
                 "roles": ["oficial_medico"], "astronauta_id": self.id}
        token = jwt.encode(datos, clave, algorithm="ES256", headers={"kid": "test-key"})
        with TestClient(protegido) as cliente:
            r = cliente.get(f"/astronautas/{self.id}/historial", headers=self.headers(token))
            self.assertEqual(r.status_code, 403, r.text)
            token_med = jwt.encode({**datos, "sub": "med"}, clave, algorithm="ES256", headers={"kid": "test-key"})
            r = cliente.get(f"/astronautas/{self.id}/historial", headers=self.headers(token_med))
            self.assertEqual(r.status_code, 200, r.text)

    def test_escala_dos_requiere_operador_medico(self):
        datos = self.dato()
        datos["signos"]["hipercapnico"] = True
        self.assertEqual(self.enviar(datos, token="astro").status_code, 403)
        self.assertEqual(self.db.contar("medicion"), 0)
        self.assertEqual(self.enviar(datos, token="med").status_code, 201)


if __name__ == "__main__":
    unittest.main()
