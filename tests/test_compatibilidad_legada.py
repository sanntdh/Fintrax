"""Portabilidad del legado; los casos originales se descubren directamente en tests/."""


def test_temporal_legado_respeta_el_directorio_del_sistema(tmp_path, monkeypatch):
    import tempfile
    from pathlib import Path
    from tests import test_api as api_legada
    monkeypatch.setattr(tempfile, "tempdir", str(tmp_path))
    caso = api_legada.APITests("test_historial_autorizacion_auditoria_y_cifrado")
    try:
        caso.setUp()
        assert Path(caso.tmp.name).parent == tmp_path
        caso.test_historial_autorizacion_auditoria_y_cifrado()
    finally:
        caso.doCleanups()


def test_pruebas_python_concentradas_en_tests():
    from pathlib import Path
    raiz = Path(__file__).resolve().parents[1]
    assert list(raiz.glob("test_*.py")) == []
