"""免許証データの区分定義。"""
LICENSE_TYPES = ["普通", "準中型", "中型", "大型", "普通二輪", "大型二輪", "原付", "小型特殊", "大型特殊", "けん引", "普通二種", "大型二種"]
COLORS = ["ゴールド", "ブルー", "グリーン"]
SEXES = ["男性", "女性"]
CONDITIONS = ["", "眼鏡等", "AT限定", "眼鏡等・AT限定", "補聴器", "眼鏡等・補聴器"]
AGE_BANDS = [(16, 19), (20, 29), (30, 39), (40, 49), (50, 59), (60, 69), (70, 74), (75, 79), (80, 84), (85, 120)]
AGE_BAND_LABELS = ["16-19", "20代", "30代", "40代", "50代", "60代", "70-74", "75-79", "80-84", "85+"]


def age_band_label(age: int) -> str:
    for (lo, hi), label in zip(AGE_BANDS, AGE_BAND_LABELS):
        if lo <= age <= hi:
            return label
    return "不明"


AGE_BAND_SQL = "CASE " + " ".join(
    f"WHEN age BETWEEN {lo} AND {hi} THEN '{label}'" for (lo, hi), label in zip(AGE_BANDS, AGE_BAND_LABELS)
) + " ELSE '不明' END"
