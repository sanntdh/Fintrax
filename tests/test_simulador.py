import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from simulador import simular


class SimuladorTests(unittest.TestCase):
    def test_semilla_reproduce_datos_y_resultados_sin_identificadores_aleatorios(self):
        a = simular(semilla=42, tripulantes=2, lecturas=5)
        b = simular(semilla=42, tripulantes=2, lecturas=5)
        self.assertEqual(a, b)
        self.assertNotEqual(a, simular(semilla=43, tripulantes=2, lecturas=5))
        self.assertTrue(a["sintetico"])
        self.assertEqual(len(a["tripulacion"]), 2)

    def test_escenarios_ejercitan_linea_base_alertas_y_cribado(self):
        r = simular()
        tripulacion = {t["escenario"]: t for t in r["tripulacion"]}
        estable = tripulacion["estable"]
        self.assertTrue(all(l["nivel"] == "BAJO" for l in estable["mediciones"]))
        self.assertTrue(estable["mediciones"][-1]["linea_base_disponible"])
        co2 = tripulacion["co2_persistente"]
        riesgo = [l for l in co2["mediciones"] if l["ambiente"].get("co2_mmhg") == 4.2]
        self.assertEqual([l["emitir_alerta"] for l in riesgo], [False, False, True])
        resuelta = next(a for a in co2["alertas"] if a["estado"] == "resuelto")
        self.assertEqual([e["estado"] for e in resuelta["eventos"]], ["nuevo", "reconocido", "resuelto"])
        self.assertEqual({a["estado"] for a in co2["alertas"]}, {"nuevo", "reconocido", "resuelto"})
        agudo = tripulacion["urgencia_news2"]
        self.assertTrue(any(l["nivel"] == "ALTO" and l["emitir_alerta"] for l in agudo["mediciones"]))
        cribado = tripulacion["cribado_complementario"]
        self.assertTrue(any(c["estado"] == "hallazgo_compatible_requiere_evaluacion"
                            for c in cribado["mediciones"][-1]["condiciones"]))
        self.assertTrue(any(a["tipo"] == "sin_mediciones" for a in cribado["alertas"]))
        for t in r["tripulacion"]:
            tiempos = [l["timestamp"] for l in t["mediciones"]]
            self.assertEqual(tiempos, sorted(set(tiempos)))
            self.assertEqual(t["evaluaciones_guardadas"], len(t["mediciones"]))

    def test_ignora_entorno_real_no_hace_red_y_limpia_base(self):
        temporales = []

        def temporal(**kw):
            tmp = TemporaryDirectory(**kw)
            temporales.append(Path(tmp.name))
            return tmp

        with patch.dict("os.environ", {"DATABASE_URL": "postgresql://real.invalid/NO_USAR",
                                        "HEALTH_ENCRYPTION_KEY": "NO_USAR",
                                        "OIDC_JWKS_URL": "https://real.invalid/NO_USAR"}):
            with patch("socket.create_connection", side_effect=AssertionError("La demo no debe hacer red")):
                with patch("simulador.TemporaryDirectory", side_effect=temporal):
                    simular(tripulantes=1, lecturas=5)
        self.assertTrue(temporales)
        self.assertTrue(all(not p.exists() for p in temporales))

    def test_cli_json_y_argumentos_invalidos(self):
        script = str(Path(__file__).resolve().parents[1] / "simulador.py")
        r = subprocess.run([sys.executable, "-B", script, "--tripulantes", "1", "--lecturas", "5",
                            "--formato", "json"], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue(json.loads(r.stdout)["sintetico"])
        for argumentos in [("--tripulantes", "0"), ("--lecturas", "4"), ("--semilla", "-1")]:
            r = subprocess.run([sys.executable, "-B", script, *argumentos], capture_output=True, text=True)
            self.assertEqual(r.returncode, 2)
            self.assertEqual(r.stdout, "")
        for parametros in [{"tripulantes": True}, {"semilla": -1}, {"lecturas": 4}]:
            with self.assertRaises(ValueError):
                simular(**parametros)


if __name__ == "__main__":
    unittest.main()
