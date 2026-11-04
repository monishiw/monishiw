"""DuckDB による免許証レコードの保存と高速集計。"""
from __future__ import annotations

import os
import threading
from contextlib import contextmanager
from typing import Any, Iterable

import duckdb

from .constants import AGE_BAND_SQL, AGE_BAND_LABELS

DATA_DIR = os.environ.get("LICENSE_DATA_DIR", os.path.join(os.path.dirname(os.path.dirname(__file__)), "data"))
DB_PATH = os.environ.get("LICENSE_DB_PATH", os.path.join(DATA_DIR, "licenses.duckdb"))
IMAGE_DIR = os.environ.get("LICENSE_IMAGE_DIR", os.path.join(DATA_DIR, "images"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS licenses (
    id              BIGINT PRIMARY KEY,
    license_no      VARCHAR NOT NULL,
    name            VARCHAR NOT NULL,
    name_kana       VARCHAR,
    sex             VARCHAR NOT NULL,
    birth_date      DATE NOT NULL,
    age             INTEGER NOT NULL,
    prefecture_code INTEGER NOT NULL,
    municipality    VARCHAR,
    address         VARCHAR,
    license_type    VARCHAR NOT NULL,      -- 最上位の免許種類
    license_types   VARCHAR NOT NULL,      -- 保有免許（カンマ区切り）
    color           VARCHAR NOT NULL,      -- ゴールド/ブルー/グリーン
    conditions      VARCHAR,
    issue_date      DATE NOT NULL,
    expiry_date     DATE NOT NULL,
    first_issue_year INTEGER,
    violation_points INTEGER DEFAULT 0,
    image_path      VARCHAR,
    ocr_confidence  DOUBLE,
    status          VARCHAR DEFAULT '有効', -- 有効/失効/返納
    updated_at      TIMESTAMP DEFAULT current_timestamp
);
CREATE SEQUENCE IF NOT EXISTS licenses_id_seq START 1;
"""

_lock = threading.Lock()
_conn: duckdb.DuckDBPyConnection | None = None


def connect() -> duckdb.DuckDBPyConnection:
    global _conn
    if _conn is None:
        os.makedirs(DATA_DIR, exist_ok=True)
        os.makedirs(IMAGE_DIR, exist_ok=True)
        _conn = duckdb.connect(DB_PATH)
        cur = _conn.cursor()
        for stmt in SCHEMA.split(";"):
            if stmt.strip():
                cur.execute(stmt)
        # 既存データがあればシーケンスを進める
        mx = cur.execute("SELECT coalesce(max(id), 0) FROM licenses").fetchall()[0][0]
        if mx:
            cur.execute(f"CREATE OR REPLACE SEQUENCE licenses_id_seq START {int(mx) + 1}")
        cur.close()
    return _conn


@contextmanager
def cursor():
    """スレッドセーフなカーソル。"""
    with _lock:
        yield connect().cursor()


def rows_to_dicts(cur) -> list[dict[str, Any]]:
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


# ---------------------------------------------------------------------------
# フィルタ
# ---------------------------------------------------------------------------
class Filters:
    """API クエリ → SQL WHERE 句。全てプレースホルダで渡す。"""

    def __init__(self, *, prefecture: Iterable[int] | None = None, region: str | None = None,
                 age_min: int | None = None, age_max: int | None = None,
                 license_type: Iterable[str] | None = None, color: Iterable[str] | None = None,
                 sex: str | None = None, status: str | None = None, q: str | None = None,
                 expiring_before: str | None = None):
        self.clauses: list[str] = []
        self.params: list[Any] = []
        prefs = list(prefecture or [])
        if region:
            from .prefectures import by_region
            prefs += [p.code for p in by_region(region)]
        if prefs:
            self.clauses.append(f"prefecture_code IN ({','.join('?' * len(prefs))})")
            self.params += prefs
        if age_min is not None:
            self.clauses.append("age >= ?"); self.params.append(age_min)
        if age_max is not None:
            self.clauses.append("age <= ?"); self.params.append(age_max)
        lt = list(license_type or [])
        if lt:
            self.clauses.append("(" + " OR ".join("list_contains(string_split(license_types, ','), ?)" for _ in lt) + ")")
            self.params += lt
        cs = list(color or [])
        if cs:
            self.clauses.append(f"color IN ({','.join('?' * len(cs))})"); self.params += cs
        if sex:
            self.clauses.append("sex = ?"); self.params.append(sex)
        if status:
            self.clauses.append("status = ?"); self.params.append(status)
        if expiring_before:
            self.clauses.append("expiry_date <= ?"); self.params.append(expiring_before)
        if q:
            self.clauses.append("(license_no ILIKE ? OR name ILIKE ? OR name_kana ILIKE ? OR address ILIKE ?)")
            self.params += [f"%{q}%"] * 4

    @property
    def where(self) -> str:
        return ("WHERE " + " AND ".join(self.clauses)) if self.clauses else ""


# ---------------------------------------------------------------------------
# 集計クエリ
# ---------------------------------------------------------------------------
def summary(f: Filters) -> dict[str, Any]:
    with cursor() as c:
        c.execute(f"""
            SELECT count(*) AS total,
                   round(avg(age), 1) AS avg_age,
                   sum(CASE WHEN age >= 65 THEN 1 ELSE 0 END) AS aged65,
                   sum(CASE WHEN age >= 75 THEN 1 ELSE 0 END) AS aged75,
                   sum(CASE WHEN color = 'ゴールド' THEN 1 ELSE 0 END) AS gold,
                   sum(CASE WHEN status = '有効' THEN 1 ELSE 0 END) AS active,
                   sum(CASE WHEN expiry_date < current_date AND status = '有効' THEN 1 ELSE 0 END) AS overdue,
                   sum(CASE WHEN sex = '女性' THEN 1 ELSE 0 END) AS female
            FROM licenses {f.where}
        """, f.params)
        r = rows_to_dicts(c)[0]
    t = r["total"] or 0
    r["aged65_share"] = round(100 * r["aged65"] / t, 1) if t else 0
    r["aged75_share"] = round(100 * r["aged75"] / t, 1) if t else 0
    r["gold_share"] = round(100 * r["gold"] / t, 1) if t else 0
    r["female_share"] = round(100 * r["female"] / t, 1) if t else 0
    return r


def breakdown(f: Filters, dimension: str) -> list[dict[str, Any]]:
    dims = {
        "age_band": AGE_BAND_SQL,
        "license_type": "license_type",
        "color": "color",
        "sex": "sex",
        "prefecture": "prefecture_code",
        "status": "status",
        "first_issue_year": "first_issue_year",
        "condition": "coalesce(nullif(conditions,''), 'なし')",
        "expiry_year": "year(expiry_date)",
    }
    if dimension not in dims:
        raise ValueError(f"unknown dimension: {dimension}")
    with cursor() as c:
        c.execute(f"""
            SELECT {dims[dimension]} AS key, count(*) AS count, round(avg(age),1) AS avg_age,
                   sum(CASE WHEN age >= 65 THEN 1 ELSE 0 END) AS aged65,
                   sum(CASE WHEN color='ゴールド' THEN 1 ELSE 0 END) AS gold
            FROM licenses {f.where}
            GROUP BY 1 ORDER BY 1
        """, f.params)
        rows = rows_to_dicts(c)
    if dimension == "age_band":
        order = {l: i for i, l in enumerate(AGE_BAND_LABELS)}
        rows.sort(key=lambda r: order.get(r["key"], 99))
    return rows


def crosstab(f: Filters, row_dim: str, col_dim: str) -> dict[str, Any]:
    dims = {"age_band": AGE_BAND_SQL, "license_type": "license_type", "color": "color",
            "sex": "sex", "prefecture": "prefecture_code", "region": "prefecture_code"}
    with cursor() as c:
        c.execute(f"""
            SELECT {dims[row_dim]} AS r, {dims[col_dim]} AS c, count(*) AS n
            FROM licenses {f.where} GROUP BY 1, 2
        """, f.params)
        rows = rows_to_dicts(c)
    return {"rows": rows}


def prefecture_matrix(f: Filters) -> list[dict[str, Any]]:
    """地図用: 都道府県 × 年齢階級 × 免許種類 の件数。"""
    with cursor() as c:
        c.execute(f"""
            SELECT prefecture_code, {AGE_BAND_SQL} AS age_band, license_type, color, count(*) AS n, round(avg(age),2) AS avg_age
            FROM licenses {f.where} GROUP BY 1,2,3,4
        """, f.params)
        return rows_to_dicts(c)


def cohort_counts(f: Filters) -> list[dict[str, Any]]:
    """推計用: 都道府県 × 年齢(1歳刻み) × 免許種類 × 色。"""
    with cursor() as c:
        c.execute(f"""
            SELECT prefecture_code, age, license_type, color, count(*) AS n
            FROM licenses {f.where} AND status = '有効' GROUP BY 1,2,3,4
        """ if f.where else """
            SELECT prefecture_code, age, license_type, color, count(*) AS n
            FROM licenses WHERE status = '有効' GROUP BY 1,2,3,4
        """, f.params)
        return rows_to_dicts(c)


# ---------------------------------------------------------------------------
# レコード管理 (CRUD)
# ---------------------------------------------------------------------------
COLUMNS = ["id", "license_no", "name", "name_kana", "sex", "birth_date", "age", "prefecture_code", "municipality",
           "address", "license_type", "license_types", "color", "conditions", "issue_date", "expiry_date",
           "first_issue_year", "violation_points", "image_path", "ocr_confidence", "status", "updated_at"]
EDITABLE = [c for c in COLUMNS if c not in ("id", "updated_at", "age")]


def list_records(f: Filters, page: int, per_page: int, sort: str = "id", desc: bool = False) -> dict[str, Any]:
    if sort not in COLUMNS:
        sort = "id"
    with cursor() as c:
        c.execute(f"SELECT count(*) FROM licenses {f.where}", f.params)
        total = c.fetchone()[0]
        c.execute(f"SELECT * FROM licenses {f.where} ORDER BY {sort} {'DESC' if desc else 'ASC'} LIMIT ? OFFSET ?",
                  f.params + [per_page, (page - 1) * per_page])
        items = rows_to_dicts(c)
    return {"total": total, "page": page, "per_page": per_page, "items": items}


def get_record(rid: int) -> dict[str, Any] | None:
    with cursor() as c:
        c.execute("SELECT * FROM licenses WHERE id = ?", [rid])
        rows = rows_to_dicts(c)
    return rows[0] if rows else None


def create_record(data: dict[str, Any]) -> dict[str, Any]:
    cols = [k for k in EDITABLE if k in data]
    with cursor() as c:
        rid = c.execute("SELECT nextval('licenses_id_seq')").fetchone()[0]
        c.execute(
            f"INSERT INTO licenses (id, age, {','.join(cols)}) VALUES (?, date_diff('year', CAST(? AS DATE), current_date), {','.join('?' * len(cols))})",
            [rid, data["birth_date"]] + [data[k] for k in cols])
    return get_record(rid)


def update_record(rid: int, data: dict[str, Any]) -> dict[str, Any] | None:
    cols = [k for k in EDITABLE if k in data]
    if not cols:
        return get_record(rid)
    sets = ", ".join(f"{k} = ?" for k in cols)
    params = [data[k] for k in cols]
    if "birth_date" in data:
        sets += ", age = date_diff('year', CAST(? AS DATE), current_date)"
        params.append(data["birth_date"])
    with cursor() as c:
        c.execute(f"UPDATE licenses SET {sets}, updated_at = current_timestamp WHERE id = ?", params + [rid])
    return get_record(rid)


def delete_record(rid: int) -> bool:
    with cursor() as c:
        c.execute("DELETE FROM licenses WHERE id = ?", [rid])
        return True


def set_image(rid: int, path: str) -> None:
    with cursor() as c:
        c.execute("UPDATE licenses SET image_path = ?, updated_at = current_timestamp WHERE id = ?", [path, rid])


def quality_report() -> dict[str, Any]:
    with cursor() as c:
        c.execute("""
            SELECT count(*) AS total,
                   sum(CASE WHEN image_path IS NULL THEN 1 ELSE 0 END) AS missing_image,
                   sum(CASE WHEN ocr_confidence < 0.8 THEN 1 ELSE 0 END) AS low_ocr,
                   sum(CASE WHEN expiry_date < current_date AND status='有効' THEN 1 ELSE 0 END) AS expired_active,
                   sum(CASE WHEN name_kana IS NULL OR name_kana='' THEN 1 ELSE 0 END) AS missing_kana,
                   sum(CASE WHEN status='返納' THEN 1 ELSE 0 END) AS returned,
                   count(DISTINCT license_no) AS distinct_no
            FROM licenses
        """)
        r = rows_to_dicts(c)[0]
    r["duplicate_no"] = (r["total"] or 0) - (r["distinct_no"] or 0)
    return r


def import_rows(rows: list[dict[str, Any]]) -> int:
    n = 0
    for row in rows:
        create_record(row)
        n += 1
    return n
