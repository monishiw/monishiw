"""免許証画像の生成・取得。

実データではスキャン画像を data/images/ 以下に置き image_path に保存する。
サンプルでは PIL で疑似的な免許証カード画像を生成する（実在の様式を模したものではない）。
"""
from __future__ import annotations

import os
from io import BytesIO

from PIL import Image, ImageDraw, ImageFont

from . import db

_FONT_CANDIDATES = [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf",
    "/System/Library/Fonts/ヒラギノ角ゴシック W4.ttc",
    "C:/Windows/Fonts/meiryo.ttc",
]


def _font(size: int):
    for p in _FONT_CANDIDATES:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except OSError:
                continue
    return ImageFont.load_default()


COLOR_BAND = {"ゴールド": (212, 175, 55), "ブルー": (60, 110, 200), "グリーン": (70, 160, 90)}


def render_card(rec: dict) -> bytes:
    """レコードからサンプルの免許証カード画像 (PNG) を生成する。"""
    w, h = 860, 540
    img = Image.new("RGB", (w, h), (246, 247, 250))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([8, 8, w - 8, h - 8], radius=28, fill=(255, 255, 255), outline=(190, 196, 206), width=3)
    band = COLOR_BAND.get(rec.get("color", ""), (120, 120, 120))
    d.rounded_rectangle([8, 8, w - 8, 70], radius=28, fill=band)
    d.rectangle([8, 40, w - 8, 70], fill=band)
    big, mid, small = _font(34), _font(24), _font(18)
    d.text((32, 20), "運転免許証（サンプル）", font=big, fill=(255, 255, 255))
    d.text((w - 330, 26), f"有効期限 {rec.get('expiry_date')}", font=mid, fill=(255, 255, 255))

    # 顔写真枠
    d.rectangle([40, 100, 240, 340], fill=(225, 230, 238), outline=(150, 160, 175), width=2)
    d.ellipse([100, 140, 180, 220], fill=(180, 190, 205))
    d.chord([70, 240, 210, 360], 180, 360, fill=(180, 190, 205))
    d.text((70, 300), "PHOTO", font=small, fill=(110, 120, 135))

    y = 100
    lines = [
        ("氏名", f"{rec.get('name')}  ({rec.get('name_kana') or ''})"),
        ("生年月日", f"{rec.get('birth_date')}  ({rec.get('age')}歳 / {rec.get('sex')})"),
        ("住所", (rec.get("address") or "")[:28]),
        ("交付", f"{rec.get('issue_date')}   初回取得 {rec.get('first_issue_year')}年"),
        ("番号", str(rec.get("license_no"))),
        ("種類", str(rec.get("license_types"))),
        ("条件等", rec.get("conditions") or "なし"),
    ]
    for label, value in lines:
        d.text((270, y), label, font=small, fill=(90, 100, 115))
        d.text((370, y - 2), value, font=mid, fill=(20, 25, 35))
        y += 46
    d.rectangle([40, 380, w - 40, 382], fill=(200, 205, 215))
    d.text((40, 400), f"区分: {rec.get('color')}   状態: {rec.get('status')}   違反点数: {rec.get('violation_points')}",
           font=mid, fill=(20, 25, 35))
    d.text((40, 450), "※ 本画像はデモ用に自動生成した架空データです。実在の人物・番号とは無関係です。", font=small, fill=(150, 60, 60))
    d.text((40, 485), f"OCR信頼度 {rec.get('ocr_confidence')}   record#{rec.get('id')}", font=small, fill=(90, 100, 115))
    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def image_bytes(rec: dict) -> tuple[bytes, str]:
    """保存済み画像があればそれを、無ければ生成画像を返す。"""
    p = rec.get("image_path")
    if p:
        full = p if os.path.isabs(p) else os.path.join(db.IMAGE_DIR, p)
        if os.path.exists(full):
            ext = os.path.splitext(full)[1].lower()
            mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}.get(ext.lstrip("."), "application/octet-stream")
            with open(full, "rb") as f:
                return f.read(), mime
    return render_card(rec), "image/png"


def save_upload(rid: int, filename: str, content: bytes) -> str:
    ext = os.path.splitext(filename)[1].lower() or ".png"
    if ext not in (".png", ".jpg", ".jpeg", ".webp"):
        raise ValueError("対応形式は PNG / JPEG / WebP です")
    # 画像として開けることを確認
    Image.open(BytesIO(content)).verify()
    sub = f"{rid // 10000:04d}"
    os.makedirs(os.path.join(db.IMAGE_DIR, sub), exist_ok=True)
    rel = f"{sub}/{rid}{ext}"
    with open(os.path.join(db.IMAGE_DIR, rel), "wb") as f:
        f.write(content)
    db.set_image(rid, rel)
    return rel
