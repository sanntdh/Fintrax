from fastapi.testclient import TestClient
import pytest

from app.main import create_app


def test_cors_vacio_por_defecto(monkeypatch):
    monkeypatch.delenv("MONITOREO_CORS_ORIGINS", raising=False)
    with TestClient(create_app("sqlite://", revision_minutos=0)) as c:
        r = c.get("/salud", headers={"Origin":"http://localhost:5173"})
        assert r.status_code == 200
        assert "access-control-allow-origin" not in r.headers


def test_cors_permite_api_key_solo_para_origen_declarado(monkeypatch):
    monkeypatch.setenv("MONITOREO_CORS_ORIGINS", "http://localhost:5173, http://127.0.0.1:5173")
    with TestClient(create_app("sqlite://", revision_minutos=0)) as c:
        headers = {"Origin":"http://localhost:5173", "Access-Control-Request-Method":"POST",
                   "Access-Control-Request-Headers":"X-API-Key,Content-Type"}
        r = c.options("/astronautas/1/mediciones", headers=headers)
        assert r.status_code == 200
        assert r.headers["access-control-allow-origin"] == headers["Origin"]
        assert "x-api-key" in r.headers["access-control-allow-headers"].lower()
        assert r.headers.get("access-control-allow-credentials") != "true"
        r = c.options("/astronautas/1/mediciones", headers={**headers,"Origin":"https://no-autorizado.invalid"})
        assert r.status_code == 400
        assert "access-control-allow-origin" not in r.headers


@pytest.mark.parametrize("origen", ["*", "https://usuario:clave@ejemplo.invalid", "https://ejemplo.invalid/ruta"])
def test_cors_rechaza_comodines_credenciales_y_rutas(monkeypatch, origen):
    monkeypatch.setenv("MONITOREO_CORS_ORIGINS", origen)
    with pytest.raises(ValueError, match="origen"):
        create_app("sqlite://", revision_minutos=0)
