# ComfyUI-PromptTagEditor

プロンプトを**タグ(チップ)単位で編集**できる ComfyUI 専用ノード **`Prompt Tag Editor 🏷️`** を追加します。SD-WebUI の `sd-webui-prompt-all-in-one` のタグ編集体験を ComfyUI 上で再現します。

チップUIは**このノードの text 欄にのみ**表示され、`CLIP Text Encode` や `Note` など**既存のノードには一切影響しません**。

## 使い方

1. ノード追加メニュー `utils/prompt` → **`Prompt Tag Editor 🏷️`** を配置。
2. text 欄にプロンプトを入力すると、その下の「Tags」エリアにタグがチップ表示されます。
3. `text`(STRING)出力を、`CLIP Text Encode` の text 入力(右クリック → Convert text to input)や、任意のテキスト入力へ接続します。

## 特徴

- **タグ編集エリアを分離表示**: 上=生プロンプトの `<textarea>`、下=チップ(タグ)エリア。双方向に同期します。
- **タグ単位の操作**:
  - 各タグをダブルクリックで**個別編集**
  - `+` / `−` で**重み調整**(`(word:1.2)` 構文、0.05刻み、1.0付近で括弧自動除去)
  - **ドラッグ&ドロップで並べ替え**
  - `×` で**削除**
- **非破壊**: 値はネイティブのテキストウィジェットが保持するため、ワークフロー保存・実行時プロンプトに確実に反映されます。LoRA `<lora:...>`・`BREAK`・エスケープ・括弧内カンマも壊しません。

設定 → `Prompt Tag Editor: タグ編集エリアを表示` でチップエリアのON/OFFができます。

## インストール

```
git clone https://github.com/4thCafe/ComfyUI-PromptTagEditor
```
を ComfyUI の `custom_nodes` に配置して ComfyUI を再起動してください。追加のPython依存はありません。

## ロードマップ

- [x] タグ編集コア(チップ化・個別編集・重み・並べ替え・削除)
- [ ] 各タグの翻訳表示(オフライン: argostranslate)
- [ ] 入力欄の構文ハイライト

## License

MIT
