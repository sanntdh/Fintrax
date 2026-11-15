import math
import unittest
from dataclasses import replace

from parametros import Ambiente, LineaBase, Perfil, Riesgo, Signos, evaluar, news2


class ParametrosTests(unittest.TestCase):
    def setUp(self):
        self.p = Perfil("F", 1.65, 60, 36, "natural", "lutea")
        self.s = Signos(14, 98, 115, 64, 36.7)
        self.b = LineaBase(62, 115, 14, 36.6, 98)

    def test_rechaza_los_cinco_ejemplos_invalidos(self):
        for crear in [lambda: Perfil("X", 1.8, 80, 40), lambda: Ambiente("marte"),
                      lambda: replace(self.s, pas=-5), lambda: replace(self.s, fr=math.nan),
                      lambda: replace(self.p, ciclo="suprimido")]:
            with self.subTest(crear=crear):
                with self.assertRaises(ValueError):
                    crear()

    def test_numeros_y_booleanos_no_se_coercionan(self):
        for campo in ("fc", "fr", "pas", "temp", "spo2"):
            for valor in (math.nan, math.inf, -1, True, "12"):
                with self.subTest(campo=campo, valor=valor):
                    with self.assertRaises(ValueError):
                        replace(self.s, **{campo: valor})
        with self.assertRaises(ValueError):
            replace(self.s, oxigeno_suplementario=1)

    def test_limites_news2(self):
        limites = {
            "pas": [(90, 3), (91, 2), (100, 2), (101, 1), (110, 1), (111, 0), (219, 0), (220, 3)],
            "spo2": [(91, 3), (92, 2), (93, 2), (94, 1), (95, 1), (96, 0)],
            "fr": [(8, 3), (9, 1), (11, 1), (12, 0), (20, 0), (21, 2), (24, 2), (25, 3)],
            "fc": [(40, 3), (41, 1), (50, 1), (51, 0), (90, 0), (91, 1), (110, 1), (111, 2), (130, 2), (131, 3)],
            "temp": [(35, 3), (35.1, 1), (36, 1), (36.1, 0), (38, 0), (38.1, 1), (39, 1), (39.1, 2)],
        }
        for campo, casos in limites.items():
            for valor, puntos in casos:
                with self.subTest(campo=campo, valor=valor):
                    self.assertEqual(news2(replace(self.s, **{campo: valor}))[1][campo], puntos)

    def test_escala_dos_oxigeno_y_conciencia(self):
        for oxigeno, pares in [(False, [(83, 3), (84, 2), (86, 1), (88, 0), (100, 0)]),
                               (True, [(88, 0), (92, 0), (93, 1), (95, 2), (97, 3)])]:
            for spo2, pts in pares:
                d = news2(replace(self.s, spo2=spo2, hipercapnico=True,
                                 oxigeno_suplementario=oxigeno))[1]
                self.assertEqual(d["spo2"], pts)
                self.assertEqual(d["oxigeno"], 2 if oxigeno else 0)
        for c in ("confuso", "voz", "dolor", "inconsciente"):
            self.assertEqual(news2(replace(self.s, conciencia=c))[1]["conciencia"], 3)

    def test_co2_en_cada_umbral(self):
        for co2, nivel in [(1.99, Riesgo.BAJO), (2, Riesgo.BAJO), (3.99, Riesgo.BAJO),
                           (4, Riesgo.MEDIO), (5.29, Riesgo.MEDIO), (5.3, Riesgo.ALTO),
                           (9.99, Riesgo.ALTO), (10, Riesgo.ALTO)]:
            r = evaluar(self.p, self.s, Ambiente(co2_mmhg=co2))
            self.assertEqual(r.nivel, nivel)
            if co2 == 2:
                self.assertTrue(any("CO2 >= 2" in n for n in r.notas))

    def test_ciclo_gravedad_y_eva_no_cambian_piso_news2(self):
        s = replace(self.s, temp=37.5)
        r = evaluar(self.p, s, Ambiente(), self.b)
        self.assertEqual(r.niveles_capas["desviacion"], Riesgo.BAJO)
        r_sin_fase = evaluar(replace(self.p, fase_ciclo=None), s, Ambiente(), self.b)
        self.assertEqual(r_sin_fase.niveles_capas["desviacion"], Riesgo.MEDIO)
        fase = LineaBase(62, 115, 14, 37.0, 98)
        r = evaluar(self.p, s, Ambiente(), self.b, {"lutea": fase})
        self.assertEqual(r.niveles_capas["desviacion"], Riesgo.BAJO)
        for a in [Ambiente("eva"), Ambiente(ejercicio=True), Ambiente("regreso_gravedad")]:
            r = evaluar(self.p, replace(self.s, fc=135, fr=26, pas=95, spo2=92), a, self.b)
            self.assertEqual(r.nivel, Riesgo.ALTO)
        p = replace(self.p, ciclo="suprimido", fase_ciclo=None)
        r = evaluar(p, replace(self.s, pas=102), Ambiente("regreso_gravedad"), self.b)
        self.assertEqual(r.niveles_capas["desviacion"], Riesgo.MEDIO)

    def test_evaluar_revalida_objetos_mutados(self):
        self.s.fr = math.nan
        with self.assertRaises(ValueError):
            evaluar(self.p, self.s, Ambiente())

    def test_margenes_eva_regreso_y_calibracion_efectiva(self):
        from reglas import Reglas, cargar_reglas
        p = Perfil("M", 1.70, 70, 40)
        s = replace(self.s, fc=82)
        self.assertEqual(evaluar(p, s, Ambiente(), self.b).niveles_capas["desviacion"], Riesgo.MEDIO)
        for a in (Ambiente("eva"), Ambiente(ejercicio=True), Ambiente("regreso_gravedad")):
            self.assertEqual(evaluar(p, s, a, self.b).niveles_capas["desviacion"], Riesgo.BAJO)
        datos = {**cargar_reglas().snapshot(), "offset_temp_lutea": 0}
        r = evaluar(self.p, replace(self.s, temp=37.5), Ambiente(), self.b,
                    reglas=Reglas.desde_dict(datos))
        self.assertEqual(r.niveles_capas["desviacion"], Riesgo.MEDIO)


if __name__ == "__main__":
    unittest.main()
