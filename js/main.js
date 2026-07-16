// main.js — ComfyUI拡張エントリ。Watcher起動 + 有効化トグル。
// ComfyUI-PromptTagEditor / 4thCafe

import { app } from "../../scripts/app.js";
import { Watcher } from "./input_watcher.js";

const SETTING_ID = "4thCafe.PromptTagEditor.enabled";
let enabled = true;
let watcher = null;

app.registerExtension({
  name: "4thCafe.PromptTagEditor",

  async setup() {
    // CSS読み込み
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("./style.css", import.meta.url).href;
    document.head.appendChild(link);

    // 有効化トグル
    try {
      app.ui.settings.addSetting({
        id: SETTING_ID,
        name: "Prompt Tag Editor: タグ編集エリアを表示",
        type: "boolean",
        defaultValue: true,
        onChange: (v) => { enabled = !!v; },
      });
      const cur = app.ui.settings.getSettingValue?.(SETTING_ID, true);
      enabled = cur == null ? true : !!cur;
    } catch (e) {
      console.warn("[PromptTagEditor] setting init failed:", e);
    }

    watcher = new Watcher(app, () => enabled);
    watcher.start();
  },

  // 新規ノード生成時
  async nodeCreated(node) {
    if (!watcher) return;
    requestAnimationFrame(() => watcher.attachToNode(node));
  },

  // ワークフロー読込後の既存ノード
  async loadedGraphNode(node) {
    if (!watcher) return;
    requestAnimationFrame(() => watcher.attachToNode(node));
  },
});
