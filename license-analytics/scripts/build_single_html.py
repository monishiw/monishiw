"""web/ のブラウザ版を 1 ファイルの HTML にまとめる。

    python scripts/build_single_html.py   # -> dist/menkyo-analytics.html
"""
from __future__ import annotations

import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "web")
OUT = os.path.join(ROOT, "dist", "menkyo-analytics.html")


def read(rel: str) -> str:
    with open(os.path.join(WEB, rel), encoding="utf-8") as f:
        return f.read()


def js_safe(code: str) -> str:
    # インライン <script> 内で終了タグと誤認されないようにする
    return code.replace("</script", "<\\/script").replace("<!--", "<\\!--")


html = read("index.html")
html = html.replace('<link rel="stylesheet" href="vendor/leaflet.min.css">', "<style>\n" + read("vendor/leaflet.min.css") + "\n</style>")
for src in ["vendor/leaflet.min.js", "vendor/topojson.min.js", "vendor/chart.umd.min.js", "japan.topo.js", "engine.js", "app.js"]:
    tag = f'<script src="{src}"></script>'
    assert tag in html, tag
    html = html.replace(tag, "<script>\n" + js_safe(read(src)) + "\n</script>")
assert not re.search(r'src="[^"]+\.js"', html) and 'href="vendor' not in html
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    f.write(html)
print(f"wrote {OUT} ({os.path.getsize(OUT) / 1024:.0f} KB)")
