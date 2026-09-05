from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "shadow-army"


def test_initial_army() -> None:
    response = client.get("/army")
    assert response.status_code == 200
    ids = {agent["id"] for agent in response.json()["agents"]}
    assert ids == {"commander", "keeper", "manager"}
