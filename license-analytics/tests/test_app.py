"""API の結合テスト（小規模な合成データで実行）。"""
import os
import sys
import tempfile

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
_tmp = tempfile.mkdtemp()
os.environ["LICENSE_DATA_DIR"] = _tmp
os.environ["LICENSE_DB_PATH"] = os.path.join(_tmp, "t.duckdb")
os.environ["LICENSE_IMAGE_DIR"] = os.path.join(_tmp, "images")
os.environ.pop("OPENAI_API_KEY", None)

from fastapi.testclient import TestClient  # noqa: E402

from app import db  # noqa: E402
from app.main import app  # noqa: E402
from scripts.generate_data import generate  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def seed():
    conn = db.connect().cursor()
    df = generate(5000, seed=1)
    conn.register("df", df)
    conn.execute("INSERT INTO licenses SELECT *, current_timestamp FROM df")
    conn.unregister("df")
    conn.execute("CREATE OR REPLACE SEQUENCE licenses_id_seq START 5001")
    yield


@pytest.fixture
def client():
    return TestClient(app)


def test_meta(client):
    r = client.get("/api/meta").json()
    assert len(r["prefectures"]) == 47 and "base" in r["scenarios"]


def test_summary_and_breakdown(client):
    s = client.get("/api/summary").json()
    assert s["total"] == 5000 and 0 < s["aged65_share"] < 100
    b = client.get("/api/breakdown/age_band").json()
    assert sum(r["count"] for r in b["rows"]) == 5000
    assert client.get("/api/breakdown/nope").status_code == 400
    t = client.get("/api/summary", params={"prefecture": [13, 14]}).json()
    assert 0 < t["total"] < 5000


def test_map(client):
    m = client.get("/api/map").json()
    assert len(m["prefectures"]) == 47
    assert all("aged75_share" in p for p in m["prefectures"])


def test_projection(client):
    p = client.get("/api/projection", params={"horizon": 10, "prefecture": 13}).json()
    assert p["years"][0] == 2025 and p["years"][-1] == 2035
    total_by_year = {}
    for r in p["rows"]:
        total_by_year[r["year"]] = total_by_year.get(r["year"], 0) + r["n"]
    assert all(v > 0 for v in total_by_year.values())
    # 返納促進シナリオでは基準より保有者が少なくなる
    base = client.get("/api/projection", params={"horizon": 10, "group_by": "total"}).json()["rows"][-1]["n"]
    ret = client.get("/api/projection", params={"horizon": 10, "group_by": "total", "scenario": "return_up"}).json()["rows"][-1]["n"]
    assert ret < base
    cmp = client.get("/api/projection/compare", params={"horizon": 5}).json()
    assert len(cmp["scenarios"]) == 5 and len(cmp["scenarios"][0]["series"]) == 6
    pm = client.get("/api/projection/map", params={"horizon": 10}).json()
    assert pm["year"] == 2035 and len(pm["prefectures"]) == 47


def test_ai_fallback(client):
    r = client.post("/api/ai/analyze", json={"question": "10年後は？", "prefecture": [5], "horizon": 10}).json()
    assert r["engine"] == "rule-based"
    assert r["scenarios"] and r["business_opportunities"] and "秋田県" in r["headline"]
    assert len(r["charts"]["scenarios"]) == 5 and len(r["charts"]["years"]) == 11
    r2 = client.post("/api/ai/analyze", json={"question": "10年後は？", "region": "東北", "horizon": 5}).json()
    assert r2["context_preview"]["area"] == "東北"


def test_crud_and_image(client):
    body = {"license_no": "9900000000001", "name": "試験 花子", "sex": "女性", "birth_date": "1990-01-15", "prefecture_code": 27,
            "license_type": "普通", "color": "ブルー", "issue_date": "2024-01-01", "expiry_date": "2029-02-01"}
    r = client.post("/api/records", json=body)
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    assert r.json()["age"] >= 35
    assert client.patch(f"/api/records/{rid}", json={"color": "ゴールド"}).json()["color"] == "ゴールド"
    assert client.patch(f"/api/records/{rid}", json={"color": "紫"}).status_code == 422
    img = client.get(f"/api/records/{rid}/image")
    assert img.status_code == 200 and img.headers["content-type"] == "image/png"
    up = client.post(f"/api/records/{rid}/image", files={"file": ("x.png", img.content, "image/png")})
    assert up.status_code == 200 and up.json()["image_path"].endswith(f"{rid}.png")
    assert client.get(f"/api/records/{rid}").json()["image_path"] == up.json()["image_path"]
    lst = client.get("/api/records", params={"q": "試験"}).json()
    assert lst["total"] >= 1
    assert client.delete(f"/api/records/{rid}").status_code == 204
    assert client.get(f"/api/records/{rid}").status_code == 404


def test_import_export_quality(client):
    csv_text = open(os.path.join(ROOT, "data", "import_template.csv"), encoding="utf-8").read()
    r = client.post("/api/import", files={"file": ("a.csv", csv_text.encode("utf-8"), "text/csv")}).json()
    assert r["imported"] == 1 and r["error_count"] == 0
    ex = client.get("/api/export.csv", params={"limit": 5})
    assert ex.status_code == 200 and ex.text.count("\n") == 6
    q = client.get("/api/quality").json()
    assert q["total"] >= 5000
