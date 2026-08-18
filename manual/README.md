# 取扱説明書

エンドユーザー向けの「はじめかた」。A4縦・11ページ。
Apple のクイックスタート（大きな余白・少ない文字）と
IKEA の組立説明書（番号つきの線画・可否の対比）を下敷きにしている。

## できあがるもの

| ファイル | 中身 |
|---|---|
| `思索Mindmap_取扱説明書.pdf` | 配布・印刷用。デザインはこちらが正 |
| `思索Mindmap_取扱説明書.docx` | 編集用。同じ図版・同じ構成 |

## 作り直しかた

```bash
# PDF（manual.html を Chrome で刷る）
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-pdf-header-footer --virtual-time-budget=8000 \
  --print-to-pdf="$PWD/思索Mindmap_取扱説明書.pdf" \
  "file://$PWD/manual.html"

# Word
python3 build_docx.py
```

`manual.html` が原本。文言や構成を直すときはここを直し、
同じ内容を `build_docx.py` にも反映する。

## 図版（assets/）

| 種類 | 出どころ |
|---|---|
| `editor-*.png` `crop-*.png` `new-mobile*.png` `canvas-band.png` | 実際のアプリを Playwright で 3倍解像度で撮ったもの |
| `editor-callouts.png` | 上の全画面図に A/B/C の印を焼き込んだもの |
| `mascot-*.svg` `m-*.png` | キャラクター「シコウ」。`src/components/character/Mascot.tsx` の幾何をそのまま起こしてある |
| `ico-*.png` `vignette.png` | この説明書のために描いた線画 |
| `Satoshi-*.woff2` | 見出し書体（PDF のみ。Word は Arial ＋ 游ゴシックに置換） |

スクリーンショットを撮り直す必要があるのは、UI が変わったときだけ。
その場合は開発サーバを起動したうえで、リポジトリ内の撮影スクリプトを回す。

## 注意

- **Word 版はセルの中で表が終わらないようにしてある**（`fix_cells()`）。
  これを外すと Word が勝手に段落を補い、白紙のページが混ざる。
- 見出し書体は PDF が Satoshi、Word は Arial。
  Word 側で Satoshi を使いたい場合は、閲覧する全員の端末に入れる必要がある。
