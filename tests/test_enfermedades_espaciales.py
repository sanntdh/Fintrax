import math
import unittest

from enfermedades_espaciales import (
    DatosComplementarios, Dosimetria, Estado, MedicionComparada,
    evaluar_condiciones,
)
from parametros import Ambiente, LineaBase, Perfil, Riesgo, Signos, evaluar


class CribadoTests(unittest.TestCase):
    def resultados(self, **datos):
        return {r.codigo: r for r in evaluar_condiciones(DatosComplementarios(**datos))}

    def test_ausencia_no_descarta_enfermedad(self):
        resultados = evaluar_condiciones(DatosComplementarios())
        self.assertEqual(len(resultados), 8)
        for r in resultados:
            self.assertEqual(r.estado, Estado.NO_EVALUABLE)
            self.assertTrue(r.datos_faltantes)
            self.assertTrue(r.fuentes)

    def test_radiacion_requiere_dosis_y_limite_del_mismo_periodo(self):
        for dosis, esperado in [(9, Estado.EXPOSICION_REGISTRADA),
                                (10, Estado.LIMITE_SUPERADO),
                                (11, Estado.LIMITE_SUPERADO)]:
            with self.subTest(dosis=dosis):
                r = self.resultados(dosimetria=Dosimetria(dosis, 10, "mision"))["radiacion"]
                self.assertEqual(r.estado, esperado)
                self.assertIn("no diagnostica", r.limitacion)
        r = self.resultados(dosimetria=Dosimetria(12))["radiacion"]
        self.assertEqual(r.estado, Estado.EXPOSICION_REGISTRADA)
        self.assertIn("limite_msv", r.datos_faltantes)
        r = self.resultados(dosimetria=Dosimetria(12, 10))["radiacion"]
        self.assertEqual(r.estado, Estado.EXPOSICION_REGISTRADA)
        self.assertIn("periodo", r.datos_faltantes)

    def test_perdidas_superan_incertidumbre_no_promedio_poblacional(self):
        for campo, codigo in [("densidad_osea", "perdida_osea"),
                              ("fuerza_muscular", "deterioro_muscular")]:
            for actual, esperado in [(100, Estado.SIN_SENALES),
                                     (98, Estado.SIN_SENALES),
                                     (97, Estado.SOSPECHA)]:
                with self.subTest(campo=campo, actual=actual):
                    r = self.resultados(**{campo: MedicionComparada(100, actual, 2, True)})[codigo]
                    self.assertEqual(r.estado, esperado)
            for medida in [MedicionComparada(100, 90),
                           MedicionComparada(100, 90, 2, False),
                           MedicionComparada(actual=90)]:
                self.assertEqual(self.resultados(**{campo: medida})[codigo].estado,
                                 Estado.NO_EVALUABLE)

    def test_hallazgos_no_se_inventan_desde_signos_vitales(self):
        grupos = [
            ("sans", ["cambio_visual", "hallazgo_ocular"]),
            ("intolerancia_ortostatica", ["sintomas_al_incorporarse"]),
            ("salud_mental_sueno", ["alteracion_sueno", "alteracion_animo", "dificultad_cognitiva"]),
            ("alteracion_vestibular", ["mareo_desorientacion"]),
            ("alteracion_inmunitaria", ["evaluacion_inmune_anormal"]),
        ]
        for codigo, campos in grupos:
            for campo in campos:
                with self.subTest(campo=campo):
                    self.assertEqual(self.resultados(**{campo: True})[codigo].estado, Estado.SOSPECHA)
            self.assertEqual(self.resultados(**dict.fromkeys(campos, False))[codigo].estado,
                             Estado.SIN_SENALES)
            if len(campos) > 1:
                self.assertEqual(self.resultados(**{campos[0]: False})[codigo].estado,
                                 Estado.NO_EVALUABLE)

    def test_redondeo_decimal_no_convierte_el_limite_en_perdida_significativa(self):
        r = self.resultados(densidad_osea=MedicionComparada(1.0, 0.98, 0.02, True))
        self.assertEqual(r["perdida_osea"].estado, Estado.SIN_SENALES)

    def test_entradas_invalidas_se_rechazan(self):
        for valor in [math.nan, math.inf, -1, True, "12"]:
            with self.subTest(valor=valor):
                with self.assertRaises(ValueError):
                    self.resultados(dosimetria=Dosimetria(valor))
                with self.assertRaises(ValueError):
                    self.resultados(densidad_osea=MedicionComparada(100, valor, 2, True))
        for medida in [MedicionComparada(0, 10, 1, True),
                       MedicionComparada(10, 0, 1, True),
                       MedicionComparada(10, 9, -1, True),
                       MedicionComparada(10, 9, 1, "si")]:
            with self.assertRaises(ValueError):
                self.resultados(densidad_osea=medida)
        for valor in [0, 1, "no", []]:
            with self.assertRaises(ValueError):
                self.resultados(cambio_visual=valor)

    def test_estructura_y_periodo_invalidos_se_rechazan(self):
        for datos in [DatosComplementarios(dosimetria={}),
                      DatosComplementarios(densidad_osea=2),
                      DatosComplementarios(dosimetria=Dosimetria(1, 0, "mision")),
                      DatosComplementarios(dosimetria=Dosimetria(1, 2, 123))]:
            with self.assertRaises(ValueError):
                evaluar_condiciones(datos)


class CompatibilidadTests(unittest.TestCase):
    def setUp(self):
        self.perfil = Perfil("M", 1.80, 80, 40)
        self.signos = Signos(14, 98, 115, 64, 36.7)
        self.base = LineaBase(62, 115, 14, 36.6, 98)

    def test_evaluar_preserva_campos_previos_y_piso_agudo(self):
        for signos, ambiente in [(self.signos, Ambiente(co2_mmhg=5.5)),
                                 (Signos(26, 92, 95, 135, 38.6, "confuso"), Ambiente())]:
            viejo = evaluar(self.perfil, signos, ambiente, self.base)
            nuevo = evaluar(self.perfil, signos, ambiente, self.base,
                            complementarios=DatosComplementarios(cambio_visual=True))
            for campo in ["nivel", "news2_total", "news2_desglose", "niveles_capas", "alertas", "notas"]:
                self.assertEqual(getattr(viejo, campo), getattr(nuevo, campo))
            self.assertEqual(nuevo.nivel, Riesgo.ALTO)
            self.assertEqual(next(r for r in nuevo.condiciones if r.codigo == "sans").estado,
                             Estado.SOSPECHA)

    def test_normal_no_excluye_condiciones_no_medidas(self):
        r = evaluar(self.perfil, self.signos, Ambiente(), self.base)
        self.assertEqual(r.nivel, Riesgo.BAJO)
        self.assertTrue(all(c.estado == Estado.NO_EVALUABLE for c in r.condiciones))


if __name__ == "__main__":
    unittest.main()
