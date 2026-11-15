from fastapi.testclient import TestClient
import pytest

from app.main import create_app
from app.seed import sembrar


def test_seed_real_ana_sin_alertas_luis_tendencia_sofia_ausente(tmp_path):
    url = "sqlite:///" + str(tmp_path / "seed.db")
    datos = sembrar(url)
    app = create_app(url, revision_minutos=0)
    h = {"X-API-Key": datos["claves_demo"]["medico"]}
    with TestClient(app) as c:
        alertas = c.get("/alertas", headers=h).json()
        ids = datos["astronautas"]
        assert not any(a["astronauta_id"]==ids["Ana"] for a in alertas)
        assert any(a["astronauta_id"]==ids["Luis"] and a["tipo"]=="tendencia" for a in alertas)
        assert any(a["astronauta_id"]==ids["Sofía"] and a["tipo"]=="sin_medicion" for a in alertas)
        historia = c.get(f'/astronautas/{ids["Ana"]}/historial',headers=h).json()
        assert len(historia)==1 and historia[0]["nivel"]==0
        assert historia[0]["entrada"]["perfil"]["fase_ciclo"]=="lutea"
    with pytest.raises(ValueError, match="no sobrescribe"):
        sembrar(url)
