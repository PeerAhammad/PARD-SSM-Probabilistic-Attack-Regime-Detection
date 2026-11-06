import pytest
from fastapi.testclient import TestClient
from backend.app.main import app


@pytest.fixture(scope="module")
def c():
    with TestClient(app) as client:   # context manager runs startup (model loading)
        yield client


@pytest.mark.parametrize("ds", ["cicids2017", "unswnb15"])
def test_demo_inference(c, ds):
    r = c.post("/api/predict", data={"dataset": ds, "use_demo": "true"})
    assert r.status_code == 200
    j = r.json()
    assert j["n_rows"] == len(j["predictions"]) == len(j["timeline"]["attack_probability"])
    assert j["summary"]["n_benign_pred"] + j["summary"]["n_attack_pred"] == j["n_rows"]
    assert j["evaluation"] is not None and 0 <= j["evaluation"]["roc_auc"] <= 1


def test_health_and_demo(c):
    assert all(c.get("/api/health").json()["datasets"].values())
    assert len(c.get("/api/demo").json()["datasets"]) == 2


def test_missing_columns(c):
    r = c.post("/api/predict", data={"dataset": "cicids2017"}, files={"file": ("x.csv", b"a,b\n1,2\n", "text/csv")})
    assert r.status_code == 422 and "missing" in r.json()["detail"].lower()


def test_empty_file(c):
    r = c.post("/api/predict", data={"dataset": "cicids2017"}, files={"file": ("x.csv", b"", "text/csv")})
    assert r.status_code == 422


def test_unknown_dataset(c):
    assert c.post("/api/predict", data={"dataset": "nope", "use_demo": "true"}).status_code == 422


def test_too_many_rows(c):
    feats = c.get("/api/demo").json()["datasets"][0]["features"]
    body = ",".join(feats) + "\n" + "\n".join(",".join(["0"] * len(feats)) for _ in range(5001))
    r = c.post("/api/predict", data={"dataset": "cicids2017"}, files={"file": ("x.csv", body.encode(), "text/csv")})
    assert r.status_code == 422