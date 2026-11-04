"""免許保有者の将来推計（コホート要因法の簡略版）。

考え方:
  1. 現在の保有者を「都道府県 × 1歳刻み年齢 × 免許種類 × 色」のコホートに分ける。
  2. 毎年 1 歳ずつ加齢させ、年齢別の「継続率」を掛ける。
     継続率 = 生存率 × (1 - 自主返納・失効率)。高齢になるほど返納率が上がる。
  3. 都道府県の将来人口（IPSS 推計）の年齢層別変化率を掛け、転入出・死亡の地域差を反映する。
  4. 新規取得者は、その都道府県の 18〜19 歳コホート規模 × 取得率 で毎年追加する。
  5. シナリオ係数（返納促進・免許取得率・人口推計の上振れ下振れ）で感度分析ができる。
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

import numpy as np

from .constants import AGE_BAND_LABELS, age_band_label, LICENSE_TYPES, COLORS
from .prefectures import PREFECTURES

MAX_AGE = 100
BASE_YEAR = 2025
REGIONAL_DAMPING = 0.5


@dataclass
class Scenario:
    name: str = "基準"
    horizon: int = 10                 # 推計年数
    return_rate_mult: float = 1.0     # 高齢者の自主返納率の倍率 (返納促進策=1.5 など)
    acquisition_mult: float = 1.0     # 若年層の新規取得率の倍率 (若者の車離れ=0.85 など)
    population_adjust: float = 0.0    # 人口推計の上振れ/下振れ (−0.05 = 5% 下振れ)
    migration_to_urban: float = 0.0   # 地方→都市 の追加流出率/年 (0.003 など)
    notes: str = ""


PRESET_SCENARIOS: dict[str, Scenario] = {
    "base": Scenario("基準シナリオ", notes="IPSS 推計どおりの人口変化、返納率・取得率は現状維持"),
    "return_up": Scenario("返納促進シナリオ", return_rate_mult=1.6, notes="75歳以上の返納促進策が強化され返納率 1.6 倍"),
    "youth_decline": Scenario("若年取得減少シナリオ", acquisition_mult=0.8, notes="若年層の免許取得率が 2 割低下"),
    "urban_shift": Scenario("都市集中シナリオ", migration_to_urban=0.004, population_adjust=-0.02,
                            notes="地方から三大都市圏への流出が加速、地方人口は推計比 2% 下振れ"),
    "autonomous": Scenario("自動運転普及シナリオ", return_rate_mult=1.3, acquisition_mult=0.9,
                           notes="移動サービスの普及で返納が増え、若年取得も減少"),
}

URBAN_PREFS = {11, 12, 13, 14, 23, 26, 27, 28}  # 三大都市圏（簡略）


def _base_continuation(age: int) -> float:
    """年齢別の年間継続率（生存 × 非返納）。警察庁統計の傾向を単純化。"""
    if age < 60:
        mortality = 0.0005 + (age - 18) * 0.00004 if age >= 18 else 0.0003
        return 1 - mortality - 0.001
    if age < 70:
        return 1 - 0.004 - 0.003
    if age < 75:
        return 1 - 0.010 - 0.012
    if age < 80:
        return 1 - 0.025 - 0.030
    if age < 85:
        return 1 - 0.045 - 0.060
    if age < 90:
        return 1 - 0.090 - 0.100
    return 1 - 0.150 - 0.150


def continuation(age: int, sc: Scenario) -> float:
    base = _base_continuation(age)
    if age >= 70:
        # 返納部分のみ倍率を掛ける
        loss = 1 - base
        return_share = 0.6
        loss = loss * (1 - return_share) + loss * return_share * sc.return_rate_mult
        return max(0.0, 1 - loss)
    return base


def _annual_ratio(p, age: int) -> float:
    years = 2035 - 2020
    young_ratio = (p.pop_2035 * (1 - p.aged65_2035 / 100)) / (p.pop_2020 * (1 - p.aged65_2020 / 100))
    old_ratio = (p.pop_2035 * p.aged65_2035 / 100) / (p.pop_2020 * p.aged65_2020 / 100)
    if age < 65:
        # 65歳未満の内訳: 若年ほど減少が強い（全国傾向）
        tilt = 0.95 if age < 40 else 1.02
        return (young_ratio * tilt) ** (1 / years)
    return old_ratio ** (1 / years)


_NATIONAL_CACHE: dict[int, float] = {}


def _national_ratio(age: int) -> float:
    """全国（人口加重平均）の年次変化率。地域差だけを取り出すための正規化に使う。"""
    key = 0 if age < 40 else 1 if age < 65 else 2
    if key not in _NATIONAL_CACHE:
        w = sum(p.pop_2020 for p in PREFECTURES.values())
        _NATIONAL_CACHE[key] = sum(_annual_ratio(p, age) * p.pop_2020 for p in PREFECTURES.values()) / w
    return _NATIONAL_CACHE[key]


def pop_change_ratio(pref_code: int, age: int, year: int, sc: Scenario) -> float:
    """基準年→year の間の人口推計に基づく年次変化率（年齢層別、全国平均で正規化した地域差）。

    コホート自体の加齢・死亡・返納は継続率で扱うため、ここでは転入出など地域差の要素のみ反映する。
    """
    p = PREFECTURES[pref_code]
    annual = _annual_ratio(p, age) * (1 + sc.population_adjust) ** (1 / 10)
    # 地域差のうち、既に年齢構成（コホート）に織り込まれている分を除くため半分だけを転入出要素とみなす
    adj = (annual / _national_ratio(age)) ** REGIONAL_DAMPING
    if sc.migration_to_urban:
        adj *= (1 + sc.migration_to_urban) if pref_code in URBAN_PREFS else (1 - sc.migration_to_urban)
    return adj


def acquisition_rate(pref_code: int, sc: Scenario) -> float:
    """18〜19歳人口に対する年間の新規取得率（概算）。都市部は低め。"""
    base = 0.36 if pref_code in URBAN_PREFS else 0.47
    if pref_code == 13:
        base = 0.30
    return base * sc.acquisition_mult


def youth_cohort_size(pref_code: int, year: int, base_total: float, sc: Scenario) -> float:
    """その県の 18 歳人口規模（基準年の 18〜19 歳保有者数から逆算）を年ごとに縮小させる。"""
    p = PREFECTURES[pref_code]
    years = 2035 - 2020
    young_ratio = (p.pop_2035 * (1 - p.aged65_2035 / 100)) / (p.pop_2020 * (1 - p.aged65_2020 / 100))
    annual = (young_ratio * 0.93) ** (1 / years)  # 18歳人口は若年層の中でも減少が速い
    annual *= (1 + sc.population_adjust) ** (1 / 10)
    return base_total * annual ** (year - BASE_YEAR)


def project(cohorts: list[dict], sc: Scenario, sample_scale: float = 1.0) -> dict:
    """cohorts: db.cohort_counts() の出力。sample_scale は母集団への拡大係数。

    戻り値: 年次 × 都道府県 × 年齢階級 × 免許種類 の件数テーブル。
    """
    # state[pref][type][color] = ndarray(MAX_AGE+1)
    state: dict[int, dict[str, dict[str, np.ndarray]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: np.zeros(MAX_AGE + 1))))
    for r in cohorts:
        a = min(max(int(r["age"]), 0), MAX_AGE)
        state[r["prefecture_code"]][r["license_type"]][r["color"]][a] += r["n"] * sample_scale

    # 新規取得者の「種類・色」プロファイル = 現在の 18〜24 歳の分布
    newcomer_profile: dict[int, dict[tuple[str, str], float]] = {}
    youth_base: dict[int, float] = {}
    for pref, types in state.items():
        prof: dict[tuple[str, str], float] = {}
        total = 0.0
        for t, colors in types.items():
            for col, arr in colors.items():
                v = arr[18:25].sum()
                if v > 0:
                    prof[(t, col)] = v
                    total += v
        if total > 0:
            newcomer_profile[pref] = {k: v / total for k, v in prof.items()}
        else:
            newcomer_profile[pref] = {("普通", "グリーン"): 1.0}
        # 新規取得者の年間規模: 22〜26 歳の 1 歳あたり人数（取得がほぼ完了した世代）を基準にする
        youth_base[pref] = sum(arr[22:27].sum() for colors in types.values() for arr in colors.values()) / 5.0

    cont = np.array([continuation(a, sc) for a in range(MAX_AGE + 1)])
    years = list(range(BASE_YEAR, BASE_YEAR + sc.horizon + 1))
    out_rows: list[dict] = []

    def snapshot(year: int):
        for pref, types in state.items():
            for t, colors in types.items():
                for col, arr in colors.items():
                    for label, (lo, hi) in zip(AGE_BAND_LABELS, _bands()):
                        v = arr[lo:hi + 1].sum()
                        if v > 0.5:
                            out_rows.append({"year": year, "prefecture_code": pref, "age_band": label,
                                             "license_type": t, "color": col, "n": float(round(v, 1))})

    snapshot(BASE_YEAR)
    for year in years[1:]:
        for pref, types in state.items():
            adj = np.array([pop_change_ratio(pref, a, year, sc) for a in range(MAX_AGE + 1)])
            for t, colors in types.items():
                for col, arr in colors.items():
                    aged = np.zeros_like(arr)
                    aged[1:] = arr[:-1] * cont[:-1] * adj[:-1]
                    aged[MAX_AGE] += arr[MAX_AGE] * cont[MAX_AGE]
                    colors[col] = aged
            # 新規取得 (18〜21 歳に配分して追加)
            new_total = youth_cohort_size(pref, year, youth_base[pref], sc) * (acquisition_rate(pref, sc) / acquisition_rate(pref, Scenario()))
            for (t, col), share in newcomer_profile[pref].items():
                for a, wgt in ((18, 0.35), (19, 0.30), (20, 0.20), (21, 0.15)):
                    state[pref][t][col][a] += new_total * share * wgt
            # 色の遷移: グリーン→ブルー (3年)、ブルー→ゴールド (無事故5年) を簡略化
            for t in list(state[pref].keys()):
                g = state[pref][t]["グリーン"]
                b = state[pref][t]["ブルー"]
                gold = state[pref][t]["ゴールド"]
                move_gb = g * (1 / 3)
                move_bg = b * 0.12
                move_gb_back = gold * 0.03
                state[pref][t]["グリーン"] = g - move_gb
                state[pref][t]["ブルー"] = b + move_gb - move_bg + move_gb_back
                state[pref][t]["ゴールド"] = gold + move_bg - move_gb_back
        snapshot(year)

    return {"scenario": sc.__dict__, "base_year": BASE_YEAR, "years": years, "rows": out_rows}


def _bands():
    from .constants import AGE_BANDS
    return [(lo, min(hi, MAX_AGE)) for lo, hi in AGE_BANDS]


def aggregate(result: dict, by: tuple[str, ...]) -> list[dict]:
    agg: dict[tuple, float] = defaultdict(float)
    for r in result["rows"]:
        agg[tuple(r[k] for k in by)] += r["n"]
    return [dict(zip(by, k), n=round(v)) for k, v in sorted(agg.items(), key=lambda kv: [str(x) for x in kv[0]])]


def prefecture_outlook(result: dict, pref_code: int) -> dict:
    """1 県分の見通しサマリ（AI 分析に渡すコンパクトな数表）。"""
    years = result["years"]
    rows = [r for r in result["rows"] if r["prefecture_code"] == pref_code]
    by_year_band: dict[int, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    by_year_type: dict[int, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    by_year_color: dict[int, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for r in rows:
        by_year_band[r["year"]][r["age_band"]] += r["n"]
        by_year_type[r["year"]][r["license_type"]] += r["n"]
        by_year_color[r["year"]][r["color"]] += r["n"]
    table = []
    for y in years:
        tot = sum(by_year_band[y].values())
        a70 = sum(v for k, v in by_year_band[y].items() if k in ("70-74", "75-79", "80-84", "85+"))
        a75 = sum(v for k, v in by_year_band[y].items() if k in ("75-79", "80-84", "85+"))
        table.append({
            "year": y, "total": round(tot),
            "age_bands": {k: round(v) for k, v in by_year_band[y].items()},
            "aged70_share": round(100 * a70 / tot, 1) if tot else 0,
            "aged75_share": round(100 * a75 / tot, 1) if tot else 0,
            "license_types": {k: round(v) for k, v in sorted(by_year_type[y].items(), key=lambda kv: -kv[1])[:6]},
            "colors": {k: round(v) for k, v in by_year_color[y].items()},
        })
    first, last = table[0], table[-1]
    return {
        "prefecture_code": pref_code,
        "prefecture": PREFECTURES[pref_code].name,
        "region": PREFECTURES[pref_code].region,
        "population_projection": PREFECTURES[pref_code].to_dict(),
        "years": table,
        "change": {
            "total_pct": round(100 * (last["total"] / first["total"] - 1), 1) if first["total"] else 0,
            "aged75_share_from": first["aged75_share"], "aged75_share_to": last["aged75_share"],
            "age_band_pct": {k: round(100 * (last["age_bands"].get(k, 0) / v - 1), 1) for k, v in first["age_bands"].items() if v},
        },
    }
