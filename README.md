# ComfyUI-PromptTagEditor

既存ノードのプロンプト入力欄(multiline STRING)を、**タグ(チップ)単位で編集**できるように強化する ComfyUI フロントエンド拡張です。SD-WebUI の `sd-webui-prompt-all-in-one` のタグ編集体験を、**追加ノードを増やさずに** ComfyUI 上で再現します。

## 特徴

- **タグ編集エリアを分離表示**: 既存の `<textarea>`(生プロンプト)はそのまま残し、その下にチップ(タグ)エリアを追加します。両者は双方向に同期します。
- **タグ単位の操作**:
  - 各タグをダブルクリックで**個別編集**
  - `+` / `−` で**重み調整**(`(word:1.2)` 構文、0.05刻み、1.0付近で括弧自動除去)
  - **ドラッグ&ドロップで並べ替え**
  - `×` で**削除**
- **既存ワークフローと非破壊**: 値はネイティブのテキストウィジェットが保持するため、ワークフロー保存・実行時プロンプトに確実に反映されます。LoRA `<lora:...>`・`BREAK`・エスケープ・括弧内カンマも壊しません。

## 対象ノード

`CLIP Text Encode` 系をはじめ、**multiline STRING 入力欄(`customtext`)を持つ全ノード**に自動適用されます。設定 → `Prompt Tag Editor: タグ編集エリアを表示` でON/OFFできます。

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
