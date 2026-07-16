// input_watcher.js — customtext(multiline STRING)ウィジェットを発見し、
// 直下にチップエリアを載せて双方向同期する。
// ComfyUI-PromptTagEditor / 4thCafe

import { TagEditor } from "./tag_editor.js";
import { Highlighter } from "./highlighter.js";

// このノード型のtextウィジェットにのみチップUIを適用(既存ノードには一切触れない)
const TARGET_NODE_TYPE = "PromptTagEditor";

export class Watcher {
  constructor(app, getEnabled) {
    this.app = app;
    this.getEnabled = getEnabled || (() => true);
  }

  // 定期スキャンで、読込タイミングに関わらず未アタッチのcustomtextへ適用(堅牢化)
  start() {
    this._scan();
    this._timer = setInterval(() => this._scan(), 1000);
  }

  _scan() {
    try {
      const g = this.app.graph;
      if (!g || !g._nodes) return;
      for (const node of g._nodes) this.attachToNode(node);
    } catch (_) {}
  }

  attachToNode(node) {
    if (!this.getEnabled()) return;
    if (!node || !node.widgets) return;
    // 専用ノードのみを対象(既存ノードは対象外)
    if ((node.comfyClass || node.type) !== TARGET_NODE_TYPE) return;
    for (const w of node.widgets) {
      if (w.type !== "customtext") continue;   // multiline STRING のみ
      if (w.__pteAttached) continue;
      try {
        this._attachWidget(node, w);
      } catch (e) {
        console.warn("[PromptTagEditor] attach failed:", e);
      }
    }
  }

  _attachWidget(node, w) {
    const ta = w.element || w.inputEl; // 実体の <textarea>(新frontendは element)
    if (!ta || ta.tagName !== "TEXTAREA") return;
    w.__pteAttached = true;

    // チップエリアのラッパDOM
    const wrap = document.createElement("div");
    wrap.className = "pte-widget-wrap";
    const header = document.createElement("div");
    header.className = "pte-widget-header";
    const title = document.createElement("span");
    title.textContent = "Tags";
    header.appendChild(title);
    const chipsEl = document.createElement("div");
    wrap.appendChild(header);
    wrap.appendChild(chipsEl);

    const editor = new TagEditor(chipsEl, (str) => this._syncToTextarea(w, ta, str));
    w.__pteEditor = editor;

    // textarea の構文ハイライト(バックドロップ方式)
    w.__pteHighlighter = new Highlighter(ta);

    // DOMウィジェットとして隣接配置(serialize:false=値はネイティブtextareaが保持)
    const dom = node.addDOMWidget(`pte_${w.name}`, "pte_chips", wrap, {
      serialize: false,
      hideOnZoom: false,
      getValue: () => "",
      setValue: () => {},
      getHeight: () => {
        const h = chipsEl.scrollHeight + 22;
        return Math.max(56, Math.min(220, h));
      },
    });
    w.__pteDom = dom;

    // 初期描画
    editor.setFromString(w.value != null ? String(w.value) : ta.value || "");

    // 逆同期: textarea手動編集 -> チップ再構築(自前同期中/編集中は抑制)
    const onInput = () => {
      if (w.__pteSyncing) return;
      if (editor.editing) return;
      clearTimeout(w.__pteDebounce);
      w.__pteDebounce = setTimeout(() => {
        if (!editor.editing && !w.__pteSyncing) editor.setFromString(ta.value);
      }, 150);
    };
    ta.addEventListener("input", onInput);

    // ノードサイズを再計算してチップエリアを見えるように
    requestAnimationFrame(() => {
      try {
        const sz = node.computeSize();
        node.setSize([Math.max(node.size[0], sz[0]), Math.max(node.size[1], sz[1])]);
        node.setDirtyCanvas(true, true);
      } catch (_) {}
    });
  }

  // チップ編集結果を textarea(=真実の値)へ3行同期
  _syncToTextarea(w, ta, str) {
    w.__pteSyncing = true;
    try {
      if (ta) {
        ta.value = str;
        ta.dispatchEvent(new Event("input", { bubbles: true }));
      }
      w.value = str;
      try { w.callback?.(str); } catch (_) {}
    } finally {
      w.__pteSyncing = false;
    }
  }
}
