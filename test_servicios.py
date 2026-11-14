from dataclasses import replace
from datetime import date, datetime, timedelta, timezone
import unittest

from parametros import Signos
from reglas import Reglas, cargar_reglas
from servicios import calcular_base, estimar_fase, temporal


class ServiciosTests(unittest.TestCase):
    def setUp(self):
        self.r = cargar_reglas()
        self.s = Signos(14, 98, 115, 64, 36.7)

    def test_mediana_minimo_y_outlier(self):
        self.assertIsNone(calcular_base([self.s] * 4, self.r)["base"])
        datos = calcular_base([self.s] * 5 + [replace(self.s, fc=200)], self.r)
        self.assertEqual(datos["base"]["fc"], 64)
        self.assertEqual(datos["descartadas"], 1)
        self.assertEqual(datos["retenidas"], 5)

    def test_reglas_inmutables_y_snapshot(self):
        self.assertEqual(Reglas.desde_dict(self.r.snapshot()).huella, self.r.huella)
        d = self.r.snapshot()
        d["offset_temp_lutea"] = 0.5
        self.assertNotEqual(Reglas.desde_dict(d).huella, self.r.huella)
        for cambio in [{"min_muestras": 1}, {"ausencia_horas": float("nan")},
                       {"mult_esfuerzo": True}, {"version": ""}]:
            with self.assertRaises(ValueError):
                Reglas.desde_dict({**self.r.snapshot(), **cambio})

    def test_calibracion_puede_desactivar_offsets(self):
        datos = {**self.r.snapshot(), "offset_temp_lutea": 0, "offset_fc_regreso": 0}
        self.assertEqual(Reglas.desde_dict(datos).offset_temp_lutea, 0)

    def test_calendario_estimado_no_confirma_ovulacion(self):
        inicio = date(2026, 1, 1)
        for dia, fase in [(1, "menstrual"), (6, "folicular"), (14, "ovulacion"), (15, "lutea")]:
            e = estimar_fase(inicio, 28, inicio + timedelta(days=dia-1), self.r)
            self.assertEqual(e["fase"], fase)
            self.assertTrue(e["estimada"])
        self.assertIsNone(estimar_fase(inicio, 28, date(2026, 2, 10), self.r)["fase"])
        with self.assertRaises(ValueError):
            estimar_fase(inicio, 28, date(2025, 12, 31), self.r)

    def test_consecutivas_tendencia_y_urgencias(self):
        ahora = datetime(2026, 1, 1, tzinfo=timezone.utc)
        serie = [{"timestamp": ahora - timedelta(minutes=2), "news2": 0, "nivel": 1},
                 {"timestamp": ahora - timedelta(minutes=1), "news2": 1, "nivel": 1}]
        d = temporal(serie, ahora, 1, 2, False, self.r)
        self.assertTrue(d["emitir"])
        self.assertEqual(d["tendencia_news2"], "ascendente")
        self.assertFalse(temporal([], ahora, 1, 0, False, self.r)["emitir"])
        self.assertTrue(temporal([], ahora, 1, 3, True, self.r)["emitir"])
        self.assertTrue(temporal([], ahora, 2, 0, False, self.r)["emitir"])
        serie[-1]["nivel"] = 0
        self.assertFalse(temporal(serie, ahora, 1, 2, False, self.r)["emitir"])
        serie[-1]["timestamp"] = ahora - timedelta(hours=2)
        self.assertFalse(temporal(serie, ahora, 1, 2, False, self.r)["emitir"])


if __name__ == "__main__":
    unittest.main()
