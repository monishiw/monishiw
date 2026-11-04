"""生成AIによるシナリオ分析。

集計結果（現状 + 将来推計）と外部データ（人口推計）を Claude に渡し、
複数シナリオ・事業機会・リスク・推奨アクションを構造化 JSON で受け取る。
ANTHROPIC_API_KEY が無い環境ではルールベースの簡易分析にフォールバックする。
"""
from __future__ import annotations

import json
import os
from typing import Any

MODEL = os.environ.get("LICENSE_AI_MODEL", "claude-opus-5-5")

SYSTEM_PROMPT = """あなたは自動車関連事業（販売・整備・保険・レンタカー・教習所・モビリティサービス）の
戦略コンサルタント兼データアナリストです。運転免許証データベースの集計結果と、
国立社会保障・人口問題研究所の地域別将来人口推計を組み合わせて、地域の将来像を分析します。

原則:
- 与えられた数表に基づいて定量的に述べる。数値を引用するときは年と単位を明示する。
- 推計には不確実性があるため、楽観・基準・悲観など複数のシナリオで幅を示す。
- 事業機会は「誰に・何を・なぜ今か」が分かる粒度で、実行可能なものに絞る。
- 日本語で、経営会議で使える簡潔な表現にする。
- 入力データはサンプル抽出（拡大係数あり）である点、人口推計は概数である点を注意事項に含める。"""

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "headline": {"type": "string", "description": "分析結果を一文で"},
        "summary": {"type": "string", "description": "現状と10年後の変化の要約（3〜5文）"},
        "key_figures": {
            "type": "array",
            "items": {"type": "object", "properties": {
                "label": {"type": "string"}, "now": {"type": "string"}, "future": {"type": "string"}, "comment": {"type": "string"}},
                "required": ["label", "now", "future", "comment"], "additionalProperties": False},
        },
        "scenarios": {
            "type": "array",
            "items": {"type": "object", "properties": {
                "name": {"type": "string"}, "probability": {"type": "string"},
                "assumptions": {"type": "string"}, "license_holder_outlook": {"type": "string"},
                "impact_on_business": {"type": "string"}},
                "required": ["name", "probability", "assumptions", "license_holder_outlook", "impact_on_business"],
                "additionalProperties": False},
        },
        "business_opportunities": {
            "type": "array",
            "items": {"type": "object", "properties": {
                "title": {"type": "string"}, "target": {"type": "string"}, "rationale": {"type": "string"},
                "market_size_hint": {"type": "string"}, "timing": {"type": "string"}, "priority": {"type": "string", "enum": ["高", "中", "低"]}},
                "required": ["title", "target", "rationale", "market_size_hint", "timing", "priority"], "additionalProperties": False},
        },
        "risks": {"type": "array", "items": {"type": "object", "properties": {
            "risk": {"type": "string"}, "mitigation": {"type": "string"}},
            "required": ["risk", "mitigation"], "additionalProperties": False}},
        "recommended_actions": {"type": "array", "items": {"type": "string"}},
        "data_notes": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["headline", "summary", "key_figures", "scenarios", "business_opportunities", "risks", "recommended_actions", "data_notes"],
    "additionalProperties": False,
}


def build_context(question: str, context: dict[str, Any]) -> str:
    return (
        "## 質問\n" + question + "\n\n"
        "## 分析対象の条件\n" + json.dumps(context.get("filters", {}), ensure_ascii=False) + "\n\n"
        "## 現状の集計（免許証データベース）\n" + json.dumps(context.get("current", {}), ensure_ascii=False) + "\n\n"
        "## 将来推計（コホート要因法、シナリオ別）\n" + json.dumps(context.get("projection", {}), ensure_ascii=False) + "\n\n"
        "## 外部データ: 地域別将来推計人口（IPSS 概数）\n" + json.dumps(context.get("population", {}), ensure_ascii=False) + "\n\n"
        "上記を踏まえ、質問に答える形で、複数シナリオと事業機会を提示してください。"
    )


def analyze(question: str, context: dict[str, Any]) -> dict[str, Any]:
    if not os.environ.get("ANTHROPIC_API_KEY") and not os.environ.get("ANTHROPIC_AUTH_TOKEN"):
        return {"engine": "rule-based", **fallback_analysis(question, context)}
    import anthropic

    client = anthropic.Anthropic()
    with client.messages.stream(
        model=MODEL,
        max_tokens=16000,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": build_context(question, context)}],
        thinking={"type": "adaptive"},
        output_config={"effort": "high", "format": {"type": "json_schema", "schema": OUTPUT_SCHEMA}},
    ) as stream:
        msg = stream.get_final_message()
    if msg.stop_reason == "refusal":
        return {"engine": "rule-based", "notice": "AI が回答を拒否したため簡易分析を表示しています。", **fallback_analysis(question, context)}
    text = next(b.text for b in msg.content if b.type == "text")
    data = json.loads(text)
    data["engine"] = MODEL
    data["usage"] = {"input_tokens": msg.usage.input_tokens, "output_tokens": msg.usage.output_tokens}
    return data


# ---------------------------------------------------------------------------
# フォールバック（API キーなし）
# ---------------------------------------------------------------------------
def fallback_analysis(question: str, context: dict[str, Any]) -> dict[str, Any]:
    proj = context.get("projection", {})
    cur = context.get("current", {})
    pop = context.get("population", {})
    base = proj.get("base", {})
    years = base.get("years", [])
    first = years[0] if years else {}
    last = years[-1] if years else {}
    change = base.get("change", {})
    area = base.get("prefecture") or context.get("filters", {}).get("area", "対象地域")
    tot_pct = change.get("total_pct", 0)
    a75_from, a75_to = change.get("aged75_share_from", 0), change.get("aged75_share_to", 0)
    pop_ratio = pop.get("total_change_ratio", 1.0)
    horizon_year = last.get("year", "")
    band_pct = change.get("age_band_pct", {})
    youth = band_pct.get("20代", 0)
    old = band_pct.get("75-79", 0)

    def alt(name: str) -> dict:
        s = proj.get(name, {})
        ys = s.get("years", [])
        return {"total": ys[-1]["total"] if ys else None, "a75": ys[-1]["aged75_share"] if ys else None}

    ret, yd, urb = alt("return_up"), alt("youth_decline"), alt("urban_shift")
    return {
        "headline": f"{area}の免許保有者は{horizon_year}年に{tot_pct:+.1f}%、75歳以上比率は{a75_from}%→{a75_to}%へ。",
        "summary": (
            f"{area}の現在の有効免許保有者は約{first.get('total', cur.get('total', 0)):,}人（拡大推計値）です。"
            f"基準シナリオでは{horizon_year}年に約{last.get('total', 0):,}人（{tot_pct:+.1f}%）となり、"
            f"75歳以上の比率は{a75_from}%から{a75_to}%へ上昇します。"
            f"20代の保有者は{youth:+.1f}%、75〜79歳は{old:+.1f}%と、若年層の縮小と高齢層の拡大が同時に進みます。"
            f"人口推計（2020→2035年）では地域人口が{(pop_ratio - 1) * 100:+.1f}%と見込まれ、免許保有者の減少はこれと整合的です。"
        ),
        "key_figures": [
            {"label": "免許保有者数", "now": f"{first.get('total', 0):,}人", "future": f"{last.get('total', 0):,}人", "comment": f"{tot_pct:+.1f}%"},
            {"label": "75歳以上比率", "now": f"{a75_from}%", "future": f"{a75_to}%", "comment": "返納・安全運転サポート需要の指標"},
            {"label": "20代保有者", "now": f"{first.get('age_bands', {}).get('20代', 0):,}人", "future": f"{last.get('age_bands', {}).get('20代', 0):,}人", "comment": f"{youth:+.1f}%"},
            {"label": "ゴールド免許", "now": f"{first.get('colors', {}).get('ゴールド', 0):,}人", "future": f"{last.get('colors', {}).get('ゴールド', 0):,}人", "comment": "優良ドライバー向け保険の母集団"},
        ],
        "scenarios": [
            {"name": "基準シナリオ", "probability": "50%", "assumptions": "人口推計どおり、返納率・取得率は現状維持",
             "license_holder_outlook": f"{horizon_year}年 約{last.get('total', 0):,}人、75歳以上 {a75_to}%",
             "impact_on_business": "新車販売は若年層の縮小で漸減。整備・車検は保有台数の減少が遅れて現れるため当面横ばい。高齢者向け安全装備・サポカー需要が拡大。"},
            {"name": "返納促進シナリオ", "probability": "25%", "assumptions": "75歳以上の返納率が1.6倍",
             "license_holder_outlook": f"{horizon_year}年 約{ret['total'] or 0:,}人、75歳以上 {ret['a75']}%",
             "impact_on_business": "高齢層の車両処分・下取りが増加し中古車流通が一時的に増える。返納後の移動手段（デマンド交通、送迎サービス）が事業機会に。"},
            {"name": "若年取得減少シナリオ", "probability": "15%", "assumptions": "若年層の取得率が2割低下",
             "license_holder_outlook": f"{horizon_year}年 約{yd['total'] or 0:,}人、75歳以上 {yd['a75']}%",
             "impact_on_business": "教習所・初回購入層の縮小。カーシェア・サブスクなど所有を前提としないサービスへの転換が必要。"},
            {"name": "都市集中シナリオ", "probability": "10%", "assumptions": "地方から都市圏への流出が加速",
             "license_holder_outlook": f"{horizon_year}年 約{urb['total'] or 0:,}人、75歳以上 {urb['a75']}%",
             "impact_on_business": "地方拠点の統廃合と、都市部での駐車場・EV充電・カーシェア需要の増加。"},
        ],
        "business_opportunities": [
            {"title": "高齢ドライバー向け安全運転サポート＆乗り換え提案", "target": "70〜79歳の有効保有者とその家族",
             "rationale": f"75歳以上比率が{a75_to}%まで上がり、認知機能検査・サポカー限定免許への移行が増える",
             "market_size_hint": f"対象 約{last.get('age_bands', {}).get('70-74', 0) + last.get('age_bands', {}).get('75-79', 0):,}人（{horizon_year}年）",
             "timing": "今後3年以内に立ち上げ", "priority": "高"},
            {"title": "免許返納者向けモビリティ・サービス（送迎、買い物代行、デマンド交通）", "target": "返納予定の80歳以上と自治体",
             "rationale": "返納促進シナリオでは返納者が大幅に増加し、公共交通が薄い地域ほど需要が顕在化する",
             "market_size_hint": f"80歳以上 約{last.get('age_bands', {}).get('80-84', 0) + last.get('age_bands', {}).get('85+', 0):,}人", "timing": "自治体連携で5年以内", "priority": "高"},
            {"title": "若年層向けカーシェア・サブスク、AT限定・二輪の取得支援", "target": "18〜29歳",
             "rationale": f"20代の保有者は{youth:+.1f}%と縮小するため、所有前提から利用前提へ",
             "market_size_hint": f"20代 約{last.get('age_bands', {}).get('20代', 0):,}人", "timing": "中期", "priority": "中"},
            {"title": "ゴールド免許層向け優良ドライバー保険・ロイヤリティ", "target": "ゴールド免許保有者",
             "rationale": "高齢化によりゴールド比率は上昇し、低リスク層の囲い込みが収益性を左右する",
             "market_size_hint": f"約{last.get('colors', {}).get('ゴールド', 0):,}人", "timing": "即時", "priority": "中"},
        ],
        "risks": [
            {"risk": "高齢層の返納が想定より早く進み、保有台数・整備需要が急減する", "mitigation": "返納者向けサービスへの早期シフト、拠点の多機能化"},
            {"risk": "若年層の免許離れによる新規顧客の枯渇", "mitigation": "カーシェア・サブスクで接点を維持し、ライフステージ変化時に販売へ接続"},
            {"risk": "人口推計の下振れ（災害・産業構造変化）", "mitigation": "年次で免許データを更新し推計を再計算、拠点投資は段階的に"},
        ],
        "recommended_actions": [
            "70歳以上の保有者を市区町村単位で可視化し、返納見込みと接点（整備入庫履歴）を紐づける",
            "若年層比率が高いエリアにカーシェア拠点を先行配置する",
            "自治体のデマンド交通・返納支援制度と連携した送迎サービスを試行する",
            "推計を毎年更新し、シナリオごとの KPI（保有者数、75歳以上比率、ゴールド比率）をモニタリングする",
        ],
        "data_notes": [
            "免許証データはサンプル抽出のため拡大係数で母集団規模に換算しています",
            "人口推計は国立社会保障・人口問題研究所の公表値を概数化したものです",
            "ANTHROPIC_API_KEY を設定すると生成AIによる詳細分析に切り替わります",
        ],
    }
