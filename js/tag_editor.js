// tag_editor.js — チップ(タグ)エリアの描画と操作(編集 / +/- / × / ドラッグ並べ替え)
// ComfyUI-PromptTagEditor / 4thCafe

import {
  tokenize, serialize, adjustWeight, setTokenText, displayLabel,
} from "./prompt_parser.js";

const WEIGHT_STEP = 0.05;

export class TagEditor {
  /**
   * @param {HTMLElement} container チップを描画するコンテナ
   * @param {(promptStr:string)=>void} onChange チップ変更時に呼ばれる(文字列を同期)
   */
  constructor(container, onChange) {
    this.container = container;
    this.onChange = onChange || (() => {});
    this.tokens = [];
    this.editing = false;       // inline編集中(逆同期抑制用)
    this._dragIndex = -1;
    this.container.classList.add("pte-chips");
  }

  // 外部の文字列からチップを再構築(逆同期時)
  setFromString(str) {
    if (this.editing) return; // 編集中は再構築しない
    this.tokens = tokenize(str);
    this.render();
  }

  _emit() {
    this.onChange(serialize(this.tokens));
  }

  _emitAndRender() {
    this._emit();
    this.render();
  }

  render() {
    const c = this.container;
    c.innerHTML = "";
    this.tokens.forEach((tok, idx) => {
      c.appendChild(this._buildChip(tok, idx));
    });
    if (this.tokens.length === 0) {
      const empty = document.createElement("span");
      empty.className = "pte-empty";
      empty.textContent = "(no tags)";
      c.appendChild(empty);
    }
  }

  _buildChip(tok, idx) {
    const chip = document.createElement("div");
    chip.className = "pte-chip";
    chip.dataset.type = tok.type;
    if (tok.type === "tag" && Math.abs(tok.weight - 1.0) > 0.001) {
      chip.classList.add("pte-weighted");
    }
    chip.draggable = true;

    // ドラッグ並べ替え
    chip.addEventListener("dragstart", (e) => {
      this._dragIndex = idx;
      chip.classList.add("pte-dragging");
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", String(idx)); } catch (_) {}
    });
    chip.addEventListener("dragend", () => {
      chip.classList.remove("pte-dragging");
      this._dragIndex = -1;
    });
    chip.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });
    chip.addEventListener("drop", (e) => {
      e.preventDefault();
      const from = this._dragIndex;
      if (from < 0 || from === idx) return;
      const [moved] = this.tokens.splice(from, 1);
      // from < idx の場合、削除で1つ詰まるため補正
      const to = from < idx ? idx - 1 : idx;
      this.tokens.splice(to, 0, moved);
      this._emitAndRender();
    });

    // ラベル(ダブルクリックでinline編集)
    const label = document.createElement("span");
    label.className = "pte-chip-label";
    label.textContent = displayLabel(tok);
    label.title = tok.raw;
    label.addEventListener("dblclick", () => this._startEdit(chip, label, tok));
    chip.appendChild(label);

    // 操作ボタン
    const btns = document.createElement("span");
    btns.className = "pte-chip-btns";
    if (tok.type === "tag") {
      btns.appendChild(this._btn("pte-w-dec", "−", "重みを下げる", (e) => {
        e.stopPropagation();
        adjustWeight(tok, -WEIGHT_STEP);
        this._emitAndRender();
      }));
      btns.appendChild(this._btn("pte-w-inc", "+", "重みを上げる", (e) => {
        e.stopPropagation();
        adjustWeight(tok, WEIGHT_STEP);
        this._emitAndRender();
      }));
    }
    btns.appendChild(this._btn("pte-del", "×", "削除", (e) => {
      e.stopPropagation();
      this.tokens.splice(idx, 1);
      this._emitAndRender();
    }));
    chip.appendChild(btns);
    return chip;
  }

  _btn(cls, text, title, onClick) {
    const b = document.createElement("button");
    b.className = "pte-btn " + cls;
    b.type = "button";
    b.textContent = text;
    b.title = title;
    b.tabIndex = -1;
    b.addEventListener("click", onClick);
    // ドラッグがボタンから始まらないように
    b.draggable = false;
    b.addEventListener("mousedown", (e) => e.stopPropagation());
    return b;
  }

  _startEdit(chip, label, tok) {
    this.editing = true;
    const input = document.createElement("input");
    input.className = "pte-chip-edit";
    input.value = tok.text;
    chip.draggable = false;
    label.replaceWith(input);
    input.focus();
    input.select();

    const commit = (save) => {
      if (this._committing) return;
      this._committing = true;
      this.editing = false;
      if (save) {
        const v = input.value.trim();
        if (v === "") {
          // 空にしたら削除
          const i = this.tokens.indexOf(tok);
          if (i >= 0) this.tokens.splice(i, 1);
        } else {
          setTokenText(tok, v);
        }
        this._emit();
      }
      this.render();
      this._committing = false;
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commit(true); }
      else if (e.key === "Escape") { e.preventDefault(); commit(false); }
      e.stopPropagation(); // ComfyUIのショートカット抑制
    });
    input.addEventListener("blur", () => commit(true));
  }
}
