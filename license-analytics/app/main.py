"""運転免許証データ 分析・管理アプリ API。"""
from __future__ import annotations

import csv
import io
import os
from typing import Any

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import ai, db, images, projection
from .constants import AGE_BAND_LABELS, COLORS, LICENSE_TYPES, SEXES, CONDITIONS
from .prefectures import PREFECTURES, REGIONS

STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
POPULATION_HOLDERS_JP = 81_000_000  # 全国の免許保有者数（概数、拡大係数の計算用）

from contextlib import asynccontextmanager  # noqa: E402


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    db.connect()
    yield


app = FastAPI(title="運転免許証データ分析アプリ", version="1.0.0", lifespan=_lifespan)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# ---------------------------------------------------------------------------
# 共通
# ---------------------------------------------------------------------------
def _filters(prefecture: list[int] | None = Query(None), region: str | None = None,
             age_min: int | None = None, age_max: int | None = None,
             license_type: list[str] | None = Query(None), color: list[str] | None = Query(None),
             sex: str | None = None, status: str | None = None, q: str | None = None,
             expiring_before: str | None = None) -> db.Filters:
    return db.Filters(prefecture=prefecture, region=region, age_min=age_min, age_max=age_max,
                      license_type=license_type, color=color, sex=sex, status=status, q=q,
                      expiring_before=expiring_before)


def _scale() -> float:
    """サンプル → 母集団への拡大係数。"""
    with db.cursor() as c:
        n = c.execute("SELECT count(*) FROM licenses WHERE status='有効'").fetchone()[0]
    return POPULATION_HOLDERS_JP / n if n else 1.0


def _scenario(name: str, horizon: int, return_rate_mult: float | None, acquisition_mult: float | None,
              population_adjust: float | None, migration_to_urban: float | None) -> projection.Scenario:
    base = projection.PRESET_SCENARIOS.get(name, projection.PRESET_SCENARIOS["base"])
    return projection.Scenario(
        name=base.name if name in projection.PRESET_SCENARIOS else "カスタム",
        horizon=max(1, min(horizon, 30)),
        return_rate_mult=base.return_rate_mult if return_rate_mult is None else return_rate_mult,
        acquisition_mult=base.acquisition_mult if acquisition_mult is None else acquisition_mult,
        population_adjust=base.population_adjust if population_adjust is None else population_adjust,
        migration_to_urban=base.migration_to_urban if migration_to_urban is None else migration_to_urban,
        notes=base.notes,
    )


@app.get("/", response_class=HTMLResponse)
def index():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


@app.get("/api/meta")
def meta():
    return {
        "prefectures": [p.to_dict() for p in PREFECTURES.values()],
        "regions": REGIONS,
        "license_types": LICENSE_TYPES, "colors": COLORS, "sexes": SEXES, "conditions": CONDITIONS,
        "age_bands": AGE_BAND_LABELS,
        "scenarios": {k: {"name": v.name, "notes": v.notes, "return_rate_mult": v.return_rate_mult,
                          "acquisition_mult": v.acquisition_mult, "population_adjust": v.population_adjust,
                          "migration_to_urban": v.migration_to_urban} for k, v in projection.PRESET_SCENARIOS.items()},
        "scale": _scale(),
        "ai_enabled": bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")),
        "ai_model": ai.MODEL,
    }


# ---------------------------------------------------------------------------
# 分析 API
# ---------------------------------------------------------------------------
@app.get("/api/summary")
def summary(f: db.Filters = Depends(_filters)):
    return db.summary(f)


@app.get("/api/breakdown/{dimension}")
def breakdown(dimension: str, f: db.Filters = Depends(_filters)):
    try:
        return {"dimension": dimension, "rows": db.breakdown(f, dimension)}
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/api/crosstab")
def crosstab(row: str = "age_band", col: str = "license_type", f: db.Filters = Depends(_filters)):
    try:
        return db.crosstab(f, row, col)
    except KeyError as e:
        raise HTTPException(400, f"unknown dimension {e}")


@app.get("/api/map")
def map_data(f: db.Filters = Depends(_filters)):
    """都道府県別の指標（地図の塗り分け用）。"""
    rows = db.prefecture_matrix(f)
    out: dict[int, dict[str, Any]] = {}
    for r in rows:
        d = out.setdefault(r["prefecture_code"], {"count": 0, "age_sum": 0.0, "aged65": 0, "aged75": 0, "gold": 0,
                                                 "by_age_band": {}, "by_type": {}, "by_color": {}})
        d["count"] += r["n"]
        d["age_sum"] += r["avg_age"] * r["n"]
        d["by_age_band"][r["age_band"]] = d["by_age_band"].get(r["age_band"], 0) + r["n"]
        d["by_type"][r["license_type"]] = d["by_type"].get(r["license_type"], 0) + r["n"]
        d["by_color"][r["color"]] = d["by_color"].get(r["color"], 0) + r["n"]
        if r["age_band"] in ("70-74", "75-79", "80-84", "85+"):
            d["aged65"] += r["n"]
        if r["age_band"] in ("75-79", "80-84", "85+"):
            d["aged75"] += r["n"]
        if r["color"] == "ゴールド":
            d["gold"] += r["n"]
    result = []
    for code, d in out.items():
        p = PREFECTURES[code]
        n = d["count"]
        holders_per_1000 = n * _scale() / (p.pop_2020 * 1000) * 1000
        result.append({
            "code": code, "name": p.name, "region": p.region, "count": n,
            "avg_age": round(d["age_sum"] / n, 1) if n else 0,
            "aged70_share": round(100 * d["aged65"] / n, 1) if n else 0,
            "aged75_share": round(100 * d["aged75"] / n, 1) if n else 0,
            "gold_share": round(100 * d["gold"] / n, 1) if n else 0,
            "holding_rate": round(holders_per_1000 / 10, 1),  # 人口に対する推定保有率 %
            "pop_change_2035": round(100 * (p.total_change_ratio - 1), 1),
            "by_age_band": d["by_age_band"], "by_type": d["by_type"], "by_color": d["by_color"],
        })
    return {"prefectures": result, "scale": _scale()}


_proj_cache: dict[str, dict] = {}


def _run_projection(f: db.Filters, sc: projection.Scenario) -> dict:
    key = f"{f.where}|{f.params}|{sc}"
    if key not in _proj_cache:
        cohorts = db.cohort_counts(f)
        _proj_cache[key] = projection.project(cohorts, sc, sample_scale=_scale())
        if len(_proj_cache) > 64:
            _proj_cache.pop(next(iter(_proj_cache)))
    return _proj_cache[key]


@app.get("/api/projection")
def projection_api(scenario: str = "base", horizon: int = 10, group_by: str = "age_band",
                   return_rate_mult: float | None = None, acquisition_mult: float | None = None,
                   population_adjust: float | None = None, migration_to_urban: float | None = None,
                   f: db.Filters = Depends(_filters)):
    sc = _scenario(scenario, horizon, return_rate_mult, acquisition_mult, population_adjust, migration_to_urban)
    res = _run_projection(f, sc)
    by = {"age_band": ("year", "age_band"), "license_type": ("year", "license_type"), "color": ("year", "color"),
          "prefecture": ("year", "prefecture_code"), "total": ("year",)}.get(group_by, ("year", "age_band"))
    return {"scenario": res["scenario"], "years": res["years"], "group_by": by[-1] if len(by) > 1 else "total",
            "rows": projection.aggregate(res, by)}


@app.get("/api/projection/compare")
def projection_compare(horizon: int = 10, f: db.Filters = Depends(_filters)):
    """全プリセットシナリオの総数・75歳以上比率を並べる。"""
    out = []
    for key, base in projection.PRESET_SCENARIOS.items():
        sc = projection.Scenario(**{**base.__dict__, "horizon": horizon})
        res = _run_projection(f, sc)
        tot = {r["year"]: r["n"] for r in projection.aggregate(res, ("year",))}
        old = {}
        for r in projection.aggregate(res, ("year", "age_band")):
            if r["age_band"] in ("75-79", "80-84", "85+"):
                old[r["year"]] = old.get(r["year"], 0) + r["n"]
        out.append({"key": key, "name": sc.name, "notes": sc.notes,
                    "series": [{"year": y, "total": tot.get(y, 0), "aged75_share": round(100 * old.get(y, 0) / tot[y], 1) if tot.get(y) else 0}
                               for y in res["years"]]})
    return {"scenarios": out}


@app.get("/api/projection/map")
def projection_map(scenario: str = "base", horizon: int = 10, f: db.Filters = Depends(_filters)):
    """都道府県別の将来変化（地図用）。"""
    sc = _scenario(scenario, horizon, None, None, None, None)
    res = _run_projection(f, sc)
    last = res["years"][-1]
    agg: dict[int, dict[str, float]] = {}
    for r in res["rows"]:
        if r["year"] not in (res["base_year"], last):
            continue
        d = agg.setdefault(r["prefecture_code"], {"now": 0, "future": 0, "now75": 0, "future75": 0})
        k = "now" if r["year"] == res["base_year"] else "future"
        d[k] += r["n"]
        if r["age_band"] in ("75-79", "80-84", "85+"):
            d[k + "75"] += r["n"]
    return {"year": last, "prefectures": [
        {"code": c, "name": PREFECTURES[c].name, "now": round(d["now"]), "future": round(d["future"]),
         "change_pct": round(100 * (d["future"] / d["now"] - 1), 1) if d["now"] else 0,
         "aged75_share_now": round(100 * d["now75"] / d["now"], 1) if d["now"] else 0,
         "aged75_share_future": round(100 * d["future75"] / d["future"], 1) if d["future"] else 0}
        for c, d in agg.items()]}


# ---------------------------------------------------------------------------
# 生成AI 分析
# ---------------------------------------------------------------------------
class AnalyzeRequest(BaseModel):
    question: str
    prefecture: list[int] | None = None
    region: str | None = None
    horizon: int = 10
    age_min: int | None = None
    age_max: int | None = None
    license_type: list[str] | None = None
    color: list[str] | None = None


@app.post("/api/ai/analyze")
def ai_analyze(req: AnalyzeRequest):
    f = db.Filters(prefecture=req.prefecture, region=req.region, age_min=req.age_min, age_max=req.age_max,
                   license_type=req.license_type, color=req.color)
    current = db.summary(f)
    current["by_age_band"] = {r["key"]: r["count"] for r in db.breakdown(f, "age_band")}
    current["by_license_type"] = {r["key"]: r["count"] for r in db.breakdown(f, "license_type")}
    current["by_color"] = {r["key"]: r["count"] for r in db.breakdown(f, "color")}
    current["scale_factor"] = round(_scale(), 2)

    proj: dict[str, Any] = {}
    for key in ("base", "return_up", "youth_decline", "urban_shift", "autonomous"):
        sc = projection.Scenario(**{**projection.PRESET_SCENARIOS[key].__dict__, "horizon": req.horizon})
        res = _run_projection(f, sc)
        if req.prefecture and len(req.prefecture) == 1:
            proj[key] = projection.prefecture_outlook(res, req.prefecture[0])
        else:
            # 複数県/全国: 合算した見通し
            tot = {r["year"]: r["n"] for r in projection.aggregate(res, ("year",))}
            bands: dict[int, dict[str, float]] = {}
            for r in projection.aggregate(res, ("year", "age_band")):
                bands.setdefault(r["year"], {})[r["age_band"]] = r["n"]
            colors: dict[int, dict[str, float]] = {}
            for r in projection.aggregate(res, ("year", "color")):
                colors.setdefault(r["year"], {})[r["color"]] = r["n"]
            years = []
            for y in res["years"]:
                a75 = sum(v for k, v in bands.get(y, {}).items() if k in ("75-79", "80-84", "85+"))
                years.append({"year": y, "total": tot.get(y, 0), "age_bands": bands.get(y, {}), "colors": colors.get(y, {}),
                              "aged75_share": round(100 * a75 / tot[y], 1) if tot.get(y) else 0})
            first, last = years[0], years[-1]
            proj[key] = {"prefecture": _area_label(req), "years": years, "change": {
                "total_pct": round(100 * (last["total"] / first["total"] - 1), 1) if first["total"] else 0,
                "aged75_share_from": first["aged75_share"], "aged75_share_to": last["aged75_share"],
                "age_band_pct": {k: round(100 * (last["age_bands"].get(k, 0) / v - 1), 1) for k, v in first["age_bands"].items() if v}}}
        proj[key]["scenario"] = {"name": sc.name, "notes": sc.notes}

    if req.prefecture and len(req.prefecture) == 1:
        population = PREFECTURES[req.prefecture[0]].to_dict()
    else:
        prefs = [PREFECTURES[c] for c in (req.prefecture or [p.code for p in PREFECTURES.values() if not req.region or p.region == req.region])]
        p20, p35 = sum(p.pop_2020 for p in prefs), sum(p.pop_2035 for p in prefs)
        population = {"area": _area_label(req), "pop_2020": p20, "pop_2035": p35, "total_change_ratio": round(p35 / p20, 4),
                      "aged65_2020": round(sum(p.pop_2020 * p.aged65_2020 for p in prefs) / p20, 1),
                      "aged65_2035": round(sum(p.pop_2035 * p.aged65_2035 for p in prefs) / p35, 1)}

    context = {"filters": {"area": _area_label(req), "horizon_years": req.horizon, "age_min": req.age_min, "age_max": req.age_max,
                           "license_type": req.license_type, "color": req.color},
               "current": current, "projection": proj, "population": population}
    try:
        result = ai.analyze(req.question, context)
    except Exception as e:  # API エラー時もフォールバックで必ず結果を返す
        result = {"engine": "rule-based", "notice": f"AI 呼び出しに失敗したため簡易分析を表示しています: {type(e).__name__}: {e}",
                  **ai.fallback_analysis(req.question, context)}
    result["context_preview"] = {"area": _area_label(req), "horizon": req.horizon, "current_total": current["total"],
                                 "scale_factor": current["scale_factor"]}
    return result


def _area_label(req: AnalyzeRequest) -> str:
    if req.prefecture:
        return "・".join(PREFECTURES[c].name for c in req.prefecture)
    if req.region:
        return req.region
    return "全国"


# ---------------------------------------------------------------------------
# 管理 API（元データ: 数値 + 画像）
# ---------------------------------------------------------------------------
class RecordIn(BaseModel):
    license_no: str
    name: str
    name_kana: str | None = None
    sex: str
    birth_date: str
    prefecture_code: int
    municipality: str | None = None
    address: str | None = None
    license_type: str
    license_types: str | None = None
    color: str
    conditions: str | None = ""
    issue_date: str
    expiry_date: str
    first_issue_year: int | None = None
    violation_points: int = 0
    ocr_confidence: float | None = None
    status: str = "有効"


class RecordPatch(BaseModel):
    license_no: str | None = None
    name: str | None = None
    name_kana: str | None = None
    sex: str | None = None
    birth_date: str | None = None
    prefecture_code: int | None = None
    municipality: str | None = None
    address: str | None = None
    license_type: str | None = None
    license_types: str | None = None
    color: str | None = None
    conditions: str | None = None
    issue_date: str | None = None
    expiry_date: str | None = None
    first_issue_year: int | None = None
    violation_points: int | None = None
    ocr_confidence: float | None = None
    status: str | None = None


def _validate(d: dict[str, Any]) -> None:
    if "sex" in d and d["sex"] not in SEXES:
        raise HTTPException(422, "性別は 男性/女性 を指定してください")
    if "color" in d and d["color"] not in COLORS:
        raise HTTPException(422, f"色は {'/'.join(COLORS)} のいずれか")
    if "license_type" in d and d["license_type"] not in LICENSE_TYPES:
        raise HTTPException(422, f"免許種類は {'/'.join(LICENSE_TYPES)} のいずれか")
    if "prefecture_code" in d and d["prefecture_code"] not in PREFECTURES:
        raise HTTPException(422, "都道府県コードが不正です")
    if "status" in d and d["status"] not in ("有効", "失効", "返納"):
        raise HTTPException(422, "状態は 有効/失効/返納 のいずれか")


@app.get("/api/records")
def records(page: int = 1, per_page: int = Query(50, le=500), sort: str = "id", desc: bool = False,
            f: db.Filters = Depends(_filters)):
    return db.list_records(f, page, per_page, sort, desc)


@app.get("/api/records/{rid}")
def record(rid: int):
    r = db.get_record(rid)
    if not r:
        raise HTTPException(404, "not found")
    return r


@app.post("/api/records", status_code=201)
def create(rec: RecordIn):
    d = rec.model_dump()
    _validate(d)
    d["license_types"] = d.get("license_types") or d["license_type"]
    return db.create_record(d)


@app.patch("/api/records/{rid}")
def patch(rid: int, rec: RecordPatch):
    d = {k: v for k, v in rec.model_dump().items() if v is not None}
    _validate(d)
    if not db.get_record(rid):
        raise HTTPException(404, "not found")
    return db.update_record(rid, d)


@app.delete("/api/records/{rid}", status_code=204)
def delete(rid: int):
    if not db.get_record(rid):
        raise HTTPException(404, "not found")
    db.delete_record(rid)
    return Response(status_code=204)


@app.get("/api/records/{rid}/image")
def record_image(rid: int):
    r = db.get_record(rid)
    if not r:
        raise HTTPException(404, "not found")
    data, mime = images.image_bytes(r)
    return Response(content=data, media_type=mime, headers={"Cache-Control": "private, max-age=300"})


@app.post("/api/records/{rid}/image")
async def upload_image(rid: int, file: UploadFile = File(...)):
    if not db.get_record(rid):
        raise HTTPException(404, "not found")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(413, "画像は 10MB 以下にしてください")
    try:
        rel = images.save_upload(rid, file.filename or "upload.png", content)
    except Exception as e:
        raise HTTPException(422, f"画像を保存できません: {e}")
    return {"image_path": rel}


@app.post("/api/import")
async def import_csv(file: UploadFile = File(...)):
    """CSV 一括登録（ヘッダは RecordIn のフィールド名）。"""
    text = (await file.read()).decode("utf-8-sig")
    rows, errors = [], []
    for i, row in enumerate(csv.DictReader(io.StringIO(text)), start=2):
        try:
            rec = RecordIn(**{k: (v if v != "" else None) for k, v in row.items() if k in RecordIn.model_fields})
            d = rec.model_dump()
            _validate(d)
            d["license_types"] = d.get("license_types") or d["license_type"]
            rows.append(d)
        except Exception as e:
            errors.append({"line": i, "error": str(e)[:200]})
    n = db.import_rows(rows)
    _proj_cache.clear()
    return {"imported": n, "errors": errors[:50], "error_count": len(errors)}


@app.get("/api/export.csv")
def export_csv(f: db.Filters = Depends(_filters), limit: int = Query(100000, le=1_000_000)):
    def gen():
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(db.COLUMNS)
        yield buf.getvalue(); buf.seek(0); buf.truncate()
        page, per = 1, 20000
        sent = 0
        while sent < limit:
            res = db.list_records(f, page, per)
            if not res["items"]:
                break
            for it in res["items"]:
                w.writerow([it[c] for c in db.COLUMNS])
                sent += 1
                if sent >= limit:
                    break
            yield buf.getvalue(); buf.seek(0); buf.truncate()
            page += 1
    return StreamingResponse(gen(), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=licenses.csv"})


@app.get("/api/quality")
def quality():
    return db.quality_report()
