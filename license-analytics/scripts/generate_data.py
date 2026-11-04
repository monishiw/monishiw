"""合成の免許証データを生成して DuckDB に投入する。

使い方:
    python scripts/generate_data.py --n 1065601          # 全件（1,065,601 件）
    python scripts/generate_data.py --n 50000 --images 200

全て架空データ。氏名・番号・住所はランダム生成で実在の人物とは無関係。
"""
from __future__ import annotations

import argparse
import os
import sys
import time

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import db  # noqa: E402
from app.constants import LICENSE_TYPES, COLORS  # noqa: E402
from app.prefectures import PREFECTURES  # noqa: E402

SURNAMES = ["佐藤", "鈴木", "高橋", "田中", "伊藤", "渡辺", "山本", "中村", "小林", "加藤", "吉田", "山田", "佐々木", "山口", "松本",
            "井上", "木村", "林", "斎藤", "清水", "山崎", "森", "池田", "橋本", "阿部", "石川", "山下", "中島", "石井", "小川",
            "前田", "岡田", "長谷川", "藤田", "後藤", "近藤", "村上", "遠藤", "青木", "坂本", "斉藤", "福田", "太田", "西村", "藤井"]
SURNAMES_KANA = ["サトウ", "スズキ", "タカハシ", "タナカ", "イトウ", "ワタナベ", "ヤマモト", "ナカムラ", "コバヤシ", "カトウ", "ヨシダ", "ヤマダ", "ササキ", "ヤマグチ", "マツモト",
                 "イノウエ", "キムラ", "ハヤシ", "サイトウ", "シミズ", "ヤマザキ", "モリ", "イケダ", "ハシモト", "アベ", "イシカワ", "ヤマシタ", "ナカジマ", "イシイ", "オガワ",
                 "マエダ", "オカダ", "ハセガワ", "フジタ", "ゴトウ", "コンドウ", "ムラカミ", "エンドウ", "アオキ", "サカモト", "サイトウ", "フクダ", "オオタ", "ニシムラ", "フジイ"]
GIVEN_M = ["太郎", "健太", "大輔", "翔太", "拓也", "誠", "浩", "隆", "健一", "直樹", "蓮", "悠真", "陽翔", "颯太", "大和", "修", "正雄", "勝", "茂", "清"]
GIVEN_M_KANA = ["タロウ", "ケンタ", "ダイスケ", "ショウタ", "タクヤ", "マコト", "ヒロシ", "タカシ", "ケンイチ", "ナオキ", "レン", "ユウマ", "ハルト", "ソウタ", "ヤマト", "オサム", "マサオ", "マサル", "シゲル", "キヨシ"]
GIVEN_F = ["花子", "美咲", "さくら", "陽菜", "結衣", "愛", "優子", "恵子", "裕子", "久美子", "葵", "凛", "芽依", "和子", "幸子", "節子", "文子", "明美", "由美", "真由美"]
GIVEN_F_KANA = ["ハナコ", "ミサキ", "サクラ", "ヒナ", "ユイ", "アイ", "ユウコ", "ケイコ", "ユウコ", "クミコ", "アオイ", "リン", "メイ", "カズコ", "サチコ", "セツコ", "フミコ", "アケミ", "ユミ", "マユミ"]
TOWNS = ["中央", "本町", "栄町", "緑町", "旭町", "幸町", "桜町", "若葉", "大手町", "新町", "東", "西", "南", "北", "駅前", "港町", "山手", "川沿", "田園", "高台"]
MUNI_SUFFIX = ["市", "市", "市", "町", "区"]

# 年齢別の相対的な保有者数（全国の年齢構成 × 保有率を単純化）
AGE_WEIGHTS = {a: w for a, w in zip(range(16, 101), np.concatenate([
    np.linspace(0.05, 0.6, 4),     # 16-19
    np.full(10, 1.0),              # 20s
    np.full(10, 1.05),             # 30s
    np.full(10, 1.35),             # 40s
    np.full(10, 1.3),              # 50s
    np.full(10, 1.15),             # 60s
    np.full(5, 1.0),               # 70-74
    np.full(5, 0.7),               # 75-79
    np.full(5, 0.35),              # 80-84
    np.linspace(0.15, 0.01, 16),   # 85-100
]))}


def generate(n: int, seed: int = 42, today: pd.Timestamp | None = None) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    today = today or pd.Timestamp.today().normalize()

    # 都道府県: 人口 × 保有率(都市部は低め)
    codes = np.array(list(PREFECTURES.keys()))
    hold_rate = np.array([0.62 if c in (13, 27) else 0.68 if c in (11, 12, 14, 23, 26, 28, 40) else 0.74 for c in codes])
    w = np.array([PREFECTURES[c].pop_2020 for c in codes]) * hold_rate
    pref = rng.choice(codes, size=n, p=w / w.sum())

    # 年齢: 県の高齢化率に応じて高齢側に偏らせる
    ages_all = np.array(list(AGE_WEIGHTS.keys()))
    base_w = np.array(list(AGE_WEIGHTS.values()))
    aged = np.array([PREFECTURES[c].aged65_2020 for c in codes])
    age = np.empty(n, dtype=int)
    for c, a65 in zip(codes, aged):
        idx = np.where(pref == c)[0]
        if len(idx) == 0:
            continue
        dev = (a65 - 28.6) / 28.6
        ramp = np.clip((ages_all - 50) / 25, 0, 1)  # 50歳から75歳にかけて滑らかに高齢側へ
        tilt = 1 + dev * (ramp * 1.6 - (1 - ramp) * 0.5)
        ww = base_w * np.clip(tilt, 0.2, None)
        age[idx] = rng.choice(ages_all, size=len(idx), p=ww / ww.sum())

    sex = np.where(rng.random(n) < (0.55 - (age - 50) * 0.0025).clip(0.45, 0.75), "男性", "女性")

    # 生年月日
    dob_year = today.year - age
    dob = pd.to_datetime({"year": dob_year, "month": rng.integers(1, 13, n), "day": rng.integers(1, 29, n)})
    had_birthday = (dob.dt.month < today.month) | ((dob.dt.month == today.month) & (dob.dt.day <= today.day))
    dob = dob - pd.to_timedelta(np.where(had_birthday, 0, 365), unit="D")  # 年齢を厳密に合わせる

    # 免許種類: 年齢・性別で分布を変える
    top = np.full(n, "普通", dtype=object)
    r = rng.random(n)
    old_rule = age >= 45  # 2007年以前取得は中型(8t限定)相当
    top[(r < 0.08) & (sex == "男性")] = "大型"
    top[(r >= 0.08) & (r < 0.14) & (sex == "男性")] = "中型"
    top[(r >= 0.14) & (r < 0.40) & old_rule] = "中型"
    top[(r >= 0.40) & (r < 0.46) & (age < 45)] = "準中型"
    top[(r >= 0.46) & (r < 0.49) & (sex == "男性") & (age >= 25)] = "大型二種"
    top[(r >= 0.49) & (r < 0.50)] = "普通二種"
    types = []
    extra = rng.random((n, 4))
    for i in range(n):
        t = [top[i]]
        if extra[i, 0] < 0.11:
            t.append("普通二輪")
        if extra[i, 1] < 0.05 and sex[i] == "男性":
            t.append("大型二輪")
        if extra[i, 2] < 0.30 and age[i] >= 50:
            t.append("原付")
        if extra[i, 3] < 0.04:
            t.append("大型特殊")
        types.append(",".join(dict.fromkeys(t)))

    # 色: 年齢が高いほどゴールド
    pg = np.clip(0.15 + (age - 20) * 0.012, 0.05, 0.80)
    pgreen = np.where(age <= 21, 0.9, np.where(age <= 24, 0.3, 0.0))
    u = rng.random(n)
    color = np.where(u < pgreen, "グリーン", np.where(u < pgreen + pg * (1 - pgreen), "ゴールド", "ブルー"))

    # 条件
    cond_r = rng.random(n)
    at = (rng.random(n) < np.where(sex == "女性", 0.55, 0.25)) & (age < 60)
    glasses = cond_r < (0.25 + (age - 30) * 0.004).clip(0.2, 0.6)
    conditions = np.select(
        [glasses & at, glasses, at, (cond_r > 0.97) & (age >= 70)],
        ["眼鏡等・AT限定", "眼鏡等", "AT限定", "補聴器"], default="")

    # 交付・有効期限・初回取得
    first_issue_year = (dob_year + rng.integers(18, 23, n)).clip(1950, None)
    too_new = first_issue_year > today.year
    first_issue_year = np.where(too_new, today.year - rng.integers(0, 3, n).clip(0, np.maximum(age - 17, 0)), first_issue_year)
    years_valid = np.where(age >= 71, 3, np.where(age == 70, 4, np.where(color == "ゴールド", 5, np.where(color == "グリーン", 3, 5))))
    days_since_issue = rng.integers(0, years_valid * 365)
    issue = today - pd.to_timedelta(days_since_issue, unit="D")
    expiry = issue + pd.to_timedelta(years_valid * 365 + 30, unit="D")

    status = np.full(n, "有効", dtype=object)
    s = rng.random(n)
    status[(s < 0.004 * np.clip(age - 70, 0, None)) & (age >= 75)] = "返納"
    status[(s > 0.985)] = "失効"
    expiry = np.where(status == "失効", today - pd.to_timedelta(rng.integers(1, 700, n), unit="D"), expiry)
    expiry = pd.to_datetime(expiry)

    points = np.where(color == "ゴールド", 0, rng.choice([0, 0, 0, 1, 2, 3, 6], size=n, p=[0.5, 0.2, 0.1, 0.08, 0.06, 0.04, 0.02]))

    # 氏名・住所
    si = rng.integers(0, len(SURNAMES), n)
    gm = rng.integers(0, len(GIVEN_M), n)
    gf = rng.integers(0, len(GIVEN_F), n)
    name = np.where(sex == "男性", np.array(SURNAMES)[si] + " " + np.array(GIVEN_M)[gm], np.array(SURNAMES)[si] + " " + np.array(GIVEN_F)[gf])
    kana = np.where(sex == "男性", np.array(SURNAMES_KANA)[si] + " " + np.array(GIVEN_M_KANA)[gm], np.array(SURNAMES_KANA)[si] + " " + np.array(GIVEN_F_KANA)[gf])
    pref_name = np.array([PREFECTURES[c].name for c in pref])
    muni = np.array([f"{SURNAMES[i % len(SURNAMES)]}{MUNI_SUFFIX[j]}" for i, j in zip(rng.integers(0, 45, n), rng.integers(0, 5, n))])
    town = np.array(TOWNS)[rng.integers(0, len(TOWNS), n)]
    address = pref_name + muni + town + rng.integers(1, 6, n).astype(str) + "丁目" + rng.integers(1, 30, n).astype(str) + "-" + rng.integers(1, 20, n).astype(str)

    license_no = np.array([f"{p:02d}{(y % 100):02d}{rng.integers(0, 10**7):07d}{rng.integers(0, 10):d}" for p, y in zip(pref, first_issue_year)])
    ocr = np.round(np.clip(rng.normal(0.96, 0.04, n), 0.5, 1.0), 3)

    df = pd.DataFrame({
        "license_no": license_no, "name": name, "name_kana": kana, "sex": sex, "birth_date": dob.dt.date, "age": age,
        "prefecture_code": pref, "municipality": muni, "address": address, "license_type": top, "license_types": types,
        "color": color, "conditions": conditions, "issue_date": issue.date, "expiry_date": expiry.date,
        "first_issue_year": first_issue_year, "violation_points": points, "image_path": None, "ocr_confidence": ocr,
        "status": status,
    })
    df.insert(0, "id", np.arange(1, n + 1))
    return df


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=1_065_601)
    ap.add_argument("--images", type=int, default=100, help="事前生成する画像枚数（残りはオンデマンド生成）")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--replace", action="store_true", help="既存データを削除して再生成")
    args = ap.parse_args()

    t0 = time.time()
    conn = db.connect().cursor()
    existing = conn.execute("SELECT count(*) FROM licenses").fetchall()[0][0]
    if existing and not args.replace:
        print(f"既に {existing:,} 件あります。--replace で再生成できます。")
        return
    conn.execute("DELETE FROM licenses")
    chunk = 200_000
    done = 0
    while done < args.n:
        m = min(chunk, args.n - done)
        df = generate(m, seed=args.seed + done)
        df["id"] += done
        conn.register("df_chunk", df)
        conn.execute("INSERT INTO licenses SELECT *, current_timestamp FROM df_chunk")
        conn.unregister("df_chunk")
        done += m
        print(f"  {done:,}/{args.n:,} 件  ({time.time() - t0:.1f}s)")
    conn.execute(f"CREATE OR REPLACE SEQUENCE licenses_id_seq START {args.n + 1}")

    if args.images:
        from app import images
        cur = conn.execute("SELECT * FROM licenses ORDER BY id LIMIT ?", [args.images])
        cols = [d[0] for d in cur.description]
        for row in cur.fetchall():
            rec = dict(zip(cols, row))
            sub = f"{rec['id'] // 10000:04d}"
            os.makedirs(os.path.join(db.IMAGE_DIR, sub), exist_ok=True)
            rel = f"{sub}/{rec['id']}.png"
            with open(os.path.join(db.IMAGE_DIR, rel), "wb") as f:
                f.write(images.render_card(rec))
            conn.execute("UPDATE licenses SET image_path = ? WHERE id = ?", [rel, rec["id"]])
        print(f"  画像 {args.images} 枚を生成")
    conn.execute("CHECKPOINT")
    print(f"完了: {args.n:,} 件 ({time.time() - t0:.1f}s) -> {db.DB_PATH}")


if __name__ == "__main__":
    main()
