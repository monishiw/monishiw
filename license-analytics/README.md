# 運転免許証データ 分析・管理アプリ

運転免許証の数値データ（1,065,601 件）と免許証画像を管理し、地域（都道府県地図）・年齢・免許種類・免許証の色などから現状と将来（10年後など）を多面的に分析する Web アプリケーションです。生成AI（OpenAI GPT）が人口推計と組み合わせて複数シナリオと事業機会を提示します。

## 画面

| 画面 | 内容 |
| --- | --- |
| 分析ダッシュボード | KPI、都道府県コロプレス地図（指標切替・クリックで絞り込み）、年齢構成、免許種類、色×年齢、年齢×種類ヒートマップ、有効期限到来年、初回取得年 |
| 将来推計 | コホート要因法による年次推計（3〜25年先）。5つのプリセットシナリオ＋スライダーで返納率・取得率・人口推計の振れ・都市流出を調整。年齢階級／免許種類／色別の推移、基準年との構成比較、シナリオ比較、推計テーブル |
| AI シナリオ分析 | 「この地域では10年後、免許保有者の年齢構成がどう変化するか。その変化が自動車関連事業にどのような影響を与えるか？」のような質問に対し、集計＋推計＋外部データ（地域別将来推計人口）を生成AI（OpenAI GPT）に渡して、要点・主要指標・複数シナリオ・事業機会（優先度付き）・リスク・推奨アクションを構造化して提示。シナリオ別の保有者数・75歳以上比率・年齢構成の変化をグラフでも表示 |
| データ管理 | データ品質KPI、検索・並べ替え・ページング、レコードの詳細（免許証画像＋全項目の編集・削除）、画像アップロード、新規登録、CSV 一括取込／出力 |

共通フィルタ（地方・都道府県・年齢範囲・免許種類・色・性別）は全画面に効きます。ライト／ダークテーマ対応。

## 単体 HTML 版（ダウンロードして開くだけ）

`dist/menkyo-analytics.html` は、ライブラリ・地図データ・アプリをすべて 1 ファイルに埋め込んだ版です（約 900KB）。ダウンロードしてダブルクリックで開くだけで、インストールもサーバーも不要で動作します。機能はブラウザ版と同じです。`web/` を変更したら `python scripts/build_single_html.py` で再生成してください。

## ブラウザ版（サーバー不要）

`web/index.html` を開くだけで動作する版も同梱しています。Python もサーバーも不要で、GitHub Pages や Vercel などの静的ホスティングにそのまま置けます。

- 初回起動時に件数（100,000／129,064／300,000／1,065,601 件）を選ぶと、合成データをブラウザ内で生成します（1,065,601 件で約4秒）。
- 集計・地図・将来推計・免許証画像の生成・CSV 入出力はすべてブラウザ内（JavaScript + TypedArray）で動作し、編集・追加・削除・アップロード画像は IndexedDB に保存されて再読み込み後も残ります。
- 生成AI 分析は右上の「AI設定」に OpenAI API キー（とモデル名）を入れると有効になります（ブラウザから api.openai.com を直接呼び出し。キーは端末の localStorage のみに保存）。未設定時はルールベースの簡易分析で応答します。
- 外部 CDN には依存しません（地図ライブラリ・境界データを同梱）。地図の背景タイル（国土地理院）だけはインターネット接続時に表示されます。

```bash
# ローカルで試す場合（file:// で開いても動作します）
cd license-analytics/web && python -m http.server 8080   # → http://localhost:8080/
```

### Vercel での公開（`menkyo` ブランチ）

GitHub の `menkyo` ブランチが Vercel 公開用です。リポジトリ直下の `vercel.json` が `/` を `/license-analytics/web/` にリダイレクトするので、Vercel プロジェクトの Production Branch を `menkyo` にすると、プロジェクトの URL を開くだけでブラウザ版が表示されます（ビルド設定は不要。Framework Preset は「Other」、Build Command・Output Directory は空のまま）。

更新手順: 開発ブランチで変更をコミット → `git checkout menkyo && git merge <開発ブランチ> && git push origin menkyo` → Vercel が自動デプロイ。

GitHub Pages で公開する場合は Settings › Pages でこのブランチを選び、`https://<ユーザー名>.github.io/<リポジトリ名>/license-analytics/web/` を開きます。

機能はサーバー版と同じです。サーバー版は複数人での共有・実データ接続・大規模運用向け、ブラウザ版はデモ・個人利用向けです。

## 構成

```
license-analytics/
├── app/
│   ├── main.py          FastAPI (分析 API / 推計 API / AI API / 管理 CRUD API)
│   ├── db.py            DuckDB スキーマ・フィルタ・集計・CRUD
│   ├── projection.py    コホート要因法による将来推計とシナリオ
│   ├── ai.py            OpenAI GPT による構造化シナリオ分析（API キー無しはルールベースに自動フォールバック）
│   ├── images.py        免許証画像の保存・取得（未登録時はサンプル画像を自動生成）
│   ├── prefectures.py   都道府県マスタ＋外部データ（IPSS 地域別将来推計人口の概数）
│   └── constants.py     免許種類・色・年齢階級の定義
├── static/              index.html / app.js（Leaflet + Chart.js）, japan.topojson, vendor/
├── web/                 ブラウザ版（engine.js がデータ生成・集計・推計・AI 呼び出しを担当。サーバー不要）
├── scripts/generate_data.py   合成データ生成（既定 1,065,601 件）
├── data/                DuckDB ファイル・画像（git 管理外）、CSV テンプレート
└── tests/test_app.py    API 結合テスト
```

- **DB**: DuckDB 1 ファイル。1,065,601 件で主要集計 20〜40ms、地図集計 0.2s、全シナリオ推計 4s（結果はキャッシュ）。
- **画像**: `data/images/` にファイル保存し DB にパスを持つ。実運用ではスキャン画像を置き換えて使う。
- **地図**: 都道府県境界 TopoJSON（dataofjapan/land）を内蔵描画し、背景に国土地理院の淡色地図タイル（API キー不要）を重ねる。タイルが取得できない環境では内蔵描画のみで表示。CDN に出られない閉域網でも動くようライブラリは `static/vendor/` に同梱。

## セットアップ

```bash
cd license-analytics
pip install -r requirements.txt
python scripts/generate_data.py --n 1065601 --images 200   # 合成データ 1,065,601 件（約45秒）
export OPENAI_API_KEY=sk-...                                 # 任意。無い場合は簡易分析で動作
uvicorn app.main:app --reload --port 8000
```

ブラウザで http://localhost:8000 を開きます。Docker の場合は `docker compose up --build`。

小さく試す場合は `--n 50000` などで十分です（推計は拡大係数で母集団規模に換算します）。

### 環境変数

| 変数 | 既定 | 説明 |
| --- | --- | --- |
| `LICENSE_DATA_DIR` | `data/` | DB と画像の保存先 |
| `LICENSE_DB_PATH` / `LICENSE_IMAGE_DIR` | 上記配下 | 個別指定 |
| `OPENAI_API_KEY` | なし | 設定すると GPT による生成AI分析が有効になる |
| `LICENSE_AI_MODEL` | `gpt-5` | 使用モデル（JSON Schema 構造化出力に対応したもの） |

## データモデル（`licenses` テーブル）

免許証番号、氏名・カナ、性別、生年月日、年齢、都道府県コード、市区町村、住所、免許種類（最上位）、保有免許（カンマ区切り）、色（ゴールド／ブルー／グリーン）、条件等、交付日、有効期限、初回取得年、違反点数、画像パス、OCR 信頼度、状態（有効／失効／返納）、更新日時。

CSV 取込の列は `data/import_template.csv` を参照してください。

## 将来推計の考え方（`app/projection.py`）

1. 有効な保有者を「都道府県 × 1歳刻み年齢 × 免許種類 × 色」のコホートに分ける。
2. 毎年 1 歳加齢させ、年齢別の継続率（生存率 ×（1 − 返納・失効率））を掛ける。70 歳以上は返納率を倍率で調整可能。
3. 国立社会保障・人口問題研究所の都道府県別将来推計人口から年齢層別の年次変化率を求め、全国平均で正規化した地域差（転入出）を反映する。
4. 新規取得者は、その県の若年コホート規模の縮小に合わせて 18〜21 歳に毎年追加する。
5. 色はグリーン→ブルー→ゴールドの遷移を簡略化して扱う。

プリセットシナリオ: 基準／返納促進／若年取得減少／都市集中／自動運転普及。スライダーで任意の感度分析ができます。

同梱の人口推計値は公表値の概数です。`data/population_projection.csv`（列: `code,pop_2020,pop_2035,aged65_2020,aged65_2035`）を置くと差し替えられます（サンプル: `data/population_projection.sample.csv`）。

## 生成AI 分析（`app/ai.py`）

OpenAI SDK で GPT（既定 `gpt-5`、Chat Completions の JSON Schema 構造化出力）を呼び、以下を JSON で受け取って画面に描画します。あわせて、シナリオ別の保有者数・75歳以上比率・年齢構成の変化をグラフ表示します。

- headline / summary / key_figures（現在と将来の主要指標）
- scenarios（名称・確からしさ・前提・保有者の見通し・事業への影響）
- business_opportunities（機会・ターゲット・根拠・規模感・時期・優先度）
- risks / recommended_actions / data_notes

入力には、フィルタ条件、現状集計、5 シナリオの年次推計（1県指定時は県別の詳細）、地域の人口推計を含めます。API キーが無い、または API エラー時はルールベースの簡易分析を返すため、画面が止まることはありません。

## 主な API

| メソッド | パス | 内容 |
| --- | --- | --- |
| GET | `/api/meta` | マスタ・シナリオ定義・拡大係数・AI 有効状態 |
| GET | `/api/summary` `/api/breakdown/{dimension}` `/api/crosstab` `/api/map` | 集計（共通フィルタ: `prefecture`, `region`, `age_min`, `age_max`, `license_type`, `color`, `sex`, `status`, `q`） |
| GET | `/api/projection` `/api/projection/compare` `/api/projection/map` | 将来推計（`scenario`, `horizon`, `group_by`, 各係数） |
| POST | `/api/ai/analyze` | 生成AI シナリオ分析 |
| GET/POST/PATCH/DELETE | `/api/records[/{id}]` | レコード CRUD |
| GET/POST | `/api/records/{id}/image` | 画像の取得／アップロード |
| POST / GET | `/api/import` `/api/export.csv` | CSV 取込／出力 |
| GET | `/api/quality` | データ品質レポート |

OpenAPI ドキュメントは `/docs` で参照できます。

## テスト

```bash
python -m pytest -q tests
```

## 注意

- 同梱の生成データ・画像は全て架空のもので、実在の人物・番号とは無関係です。
- 実データを扱う場合は個人情報保護の観点から、認証・認可、通信の暗号化、アクセスログ、保存データの暗号化を別途整備してください。本アプリには認証機能は含まれていません。
