# My Research Explained

Quarto で作る研究解説サイトです。`quarto render` を実行すると `docs/` に静的サイトができ、GitHub Pages で公開できます。

## フォルダ構成

```
my-research-explained/
├── _quarto.yml              サイト全体の設定（ナビバー、サイドバー、出力先 docs/）
├── index.qmd                ホーム
├── about.qmd                About
├── seismic-pra/
│   ├── basics/              Seismic PRA › Basics の記事
│   └── my-research/         Seismic PRA › My research の記事
├── references.bib           参考文献（[@kennedy1984] のように引用）
├── requirements.txt         図を作る Python コード用のパッケージ
├── robots.txt               検索エンジンと AI クローラーにサイト全体を許可（docs/ にコピーされる）
├── .nojekyll                docs/ にコピーされ、GitHub Pages の Jekyll 処理を止める
└── _extensions/mre/         テーマ（format: mre-html）
    ├── mre.css              デザイン本体（色・文字・サイドバー・本文の部品）
    ├── mre.js               トピックパネル（件数、説明、1つだけ開く、開閉状態の記憶）
    ├── mre-light.scss       Bootstrap の変数（ライト）
    ├── mre-dark.scss        Bootstrap の変数（ダーク）
    ├── title-metadata.html  記事見出しの著者 / 日付 / Keywords 行
    ├── mre.lua              mre.js を読み込み、_quarto.yml の mre: 設定を渡す
    └── _extension.yml
```

## Mac でビルドする

### 1. Quarto を入れる（初回のみ）

Homebrew がある場合:

```bash
brew install --cask quarto
quarto --version
```

Homebrew がない場合は https://quarto.org/docs/get-started/ から macOS 用のインストーラ（.pkg）を入れます。

### 2. Python の環境を作る（初回のみ）

`aleatory-epistemic.qmd` の図は Python（matplotlib）で描いています。Python の環境は [uv](https://docs.astral.sh/uv/) で管理します。uv が無い場合は先に入れます。

```bash
brew install uv
uv --version
```

プロジェクトのフォルダで:

```bash
cd my-research-explained
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt
quarto check jupyter        # Python と Jupyter が見つかれば OK
```

使える Python が見つからない場合は、`uv venv` が自動でダウンロードします。

### 3. 書きながら確認する

```bash
source .venv/bin/activate   # 新しいターミナルを開いたら毎回
quarto preview
```

ブラウザが開き、`.qmd` を保存するたびに自動で更新されます。終了は `Ctrl + C`。

### 4. 公開用にビルドする

```bash
quarto render
```

`docs/` にサイト一式ができます。`open docs/index.html` で中身を確認できます。

`_quarto.yml` の `freeze: auto` により、Python コードの実行結果は `_freeze/` に保存されます。ソースを変えていないページは次回からコードを実行しません。`_freeze/` もコミットしてください。

### 5. GitHub Pages で公開する

```bash
git add .
git commit -m "Update site"
git push
```

初回だけ GitHub のリポジトリで **Settings → Pages** を開き、次のように設定します。

- **Build and deployment**：Source を **Deploy from a branch**、Branch を **main**、フォルダを **/docs** にして保存
- **Custom domain**：`pra.kanagawa.jp` を入れて保存し、**Enforce HTTPS** にチェック

独自ドメインの設定はプロジェクト直下の `CNAME` ファイルにも書いてあり、ビルドのたびに `docs/CNAME` へコピーされます。`docs/` を作り直してもドメイン設定は消えません。

## AI 向けの設定

### LLM 向けテキスト（llms.txt）

`_quarto.yml` の `website: llms-txt: true` で有効にしています。`quarto render` のたびに次のファイルが `docs/` にできます。

- `llms.txt`：サイト名、説明（`website: description`）、全ページへのリンクの一覧
- 各ページの `.llms.md`：本文を Markdown にしたもの。ナビゲーションは除かれ、数式は `$...$` のまま残ります

ページに出さず LLM 向けにだけ書きたい文は `::: {.content-visible when-format="llms-txt"}` で囲みます。逆にページにだけ出す場合は `{.content-hidden when-format="llms-txt"}` です。

### robots.txt

すべてのクローラーを許可し、主な AI クローラー（GPTBot、ClaudeBot、PerplexityBot、Google-Extended など）も名前を挙げて許可しています。

`pra.kanagawa.jp` の直下（`https://pra.kanagawa.jp/robots.txt`）に置かれるので、クローラーに読まれます。最後の行でサイトマップの場所も知らせています。

## 検索エンジン向けの設定（自動で出力されるもの）

| 出力 | 設定 | 役割 |
|:--|:--|:--|
| `sitemap.xml` | `website: site-url` | 全ページの URL と更新日を検索エンジンに知らせる |
| `<link rel="canonical">` | `canonical-url: true`（テーマ） | ページの正式な URL を1つに決める |
| Open Graph / X のカード | `open-graph`、`twitter-card`、`image` | 共有時にタイトル・説明・画像（`assets/og-image.png`）を出す |
| JSON-LD（構造化データ） | テーマの `mre.lua` | ホームは WebSite、`article-type` のある記事は Article として、タイトル・説明・キーワード・著者・日付を記述 |
| `404.html` | `404.qmd` | 存在しない URL に来た人をホームへ案内する |
| `<meta name="description">` | 各ページの `description` | 検索結果の説明文の候補 |

### 著者と日付を入れる

著者は `_quarto.yml` の `author:` のコメントを外して書きます。全記事の見出しに表示され、JSON-LD にも入ります。`url` には ORCID や researchmap のページを入れてください。

```yaml
author:
  - name: "Your Name"
    url: https://orcid.org/0000-0000-0000-0000
```

日付は各記事の front matter に書きます。`date-modified` は内容を直したときに更新します。

```yaml
date: 2026-11-05
date-modified: 2026-11-20
```

## 記事を追加する

1. `.qmd` を作る。見出し部分は次の項目で決まります。

   ```yaml
   ---
   title: "記事のタイトル"
   description: "タイトルの下に出る一文"
   categories: [Seismic PRA, My research]   # タイトル上の小さなラベル
   article-type: Research note              # 画面には出ない。JSON-LD の Article の判定に使う
   keywords: [Keyword 1, Keyword 2]         # Keywords
   ---
   ```

   `article-type` を書かないページ（ホームや About）は、著者・日付・Keywords の行を表示しません。

2. `_quarto.yml` の `website: sidebar: contents:` に追加する。2段目の `section:`（例：Basics、My research）はパネルの中の小見出しになります。

ホームにはトピック名だけを出すので、記事を追加しても `index.qmd` は変更しません。

## トピックを追加する

`_quarto.yml` の `sidebar: contents:` に1段目の `section:` を足すと、新しいパネルになります。パネル内の説明文は `mre: topics:` に書きます（キーはセクション名と同じにします）。ホームの一覧に出すには、`index.qmd` の `## Topics` にそのトピックの最初の記事へのリンクを1行足します。

```yaml
mre:
  accordion: true      # 一度に開くパネルは1つ
  remember: true       # 開いていたパネルをブラウザに記憶
  topics:
    "Seismic PRA":
      note: "How shaking frequency and component fragility combine into an annual failure frequency."
    "Joint Failure Probability":
      note: "..."
```

## 本文で使える部品

- 囲み：`::: {.callout-note title="..."}` / `callout-tip` / `callout-important` / `callout-warning` / `callout-caution`
- 表：パイプ表の下に `: キャプション {#tbl-xxx}`。本文から `@tbl-xxx` で参照
- 図：Python セルに `#| label: fig-xxx` と `#| fig-cap: "..."`。本文から `@fig-xxx` で参照
- 数式：`$...$`、`$$...$$`（MathJax）
- 引用：`references.bib` に追加し、本文で `[@key]`
