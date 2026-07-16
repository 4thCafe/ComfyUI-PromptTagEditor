// tag_editor.js — チップ(タグ)エリアの描画と操作(編集 / +/- / × / ドラッグ並べ替え / 翻訳)
// ComfyUI-PromptTagEditor / 4thCafe

import {
  tokenize, serialize, adjustWeight, setTokenText, displayLabel,
} from "./prompt_parser.js";
import { translateTags } from "./translate.js";

const WEIGHT_STEP = 0.05;

// 日本語(ひらがな/カタカナ/漢字/半角カナ)を含むか
function hasJapanese(s) {
  return /[぀-ヿ㐀-鿿ｦ-ﾟ]/.test(s || "");
}

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
    this._wireDrag(chip, idx);

    // === 1段目: ラベル + 重み/削除ボタン ===
    const row = document.createElement("div");
    row.className = "pte-chip-row";

    const label = document.createElement("span");
    label.className = "pte-chip-label";
    label.textContent = displayLabel(tok);
    label.title = tok.raw;
    label.addEventListener("dblclick", () => this._startEdit(chip, label, tok));
    row.appendChild(label);

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
    row.appendChild(btns);
    chip.appendChild(row);

    // === 2段目: [訳]ボタン + 翻訳テキスト(tagのみ・最初から表示) ===
    if (tok.type === "tag") {
      const row2 = document.createElement("div");
      row2.className = "pte-chip-row2";
      const trans = document.createElement("span");
      trans.className = "pte-chip-trans";
      if (tok.__trans) trans.textContent = tok.__trans;
      // 訳ボタンは2段目の頭(将来は記号等へ変更予定)
      const tbtn = this._btn("pte-translate", "訳", "翻訳(日本語)", (e) => {
        e.stopPropagation();
        this._doTranslate(tok, trans);
      });
      row2.appendChild(tbtn);
      row2.appendChild(trans);
      chip.appendChild(row2);
    }
    return chip;
  }

  _wireDrag(chip, idx) {
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
      const to = from < idx ? idx - 1 : idx;
      this.tokens.splice(to, 0, moved);
      this._emitAndRender();
    });
  }

  async _doTranslate(tok, transEl) {
    transEl.textContent = "…";
    if (hasJapanese(tok.text)) {
      // 日本語タグ → 英語に変換してテキスト欄へ反映(置換)
      const res = await translateTags([tok.text], "ja", "en");
      let v = res && res[0] ? res[0] : null;
      if (v) {
        v = v.charAt(0).toLowerCase() + v.slice(1); // 頭文字は必ず小文字
        setTokenText(tok, v);      // タグ本体を英語へ置換
        tok.__trans = undefined;   // 訳表示はクリア
        this._emitAndRender();     // textareaへ同期 + 再描画
      } else {
        transEl.textContent = "(翻訳失敗)";
      }
    } else {
      // 英語タグ(通常タグ)→ 日本語訳を下に表示(置換しない)
      const res = await translateTags([tok.text], "en", "ja");
      const v = res && res[0] ? res[0] : null;
      if (v) {
        tok.__trans = v;
        transEl.textContent = v;
      } else {
        transEl.textContent = "(翻訳失敗)";
      }
    }
  }

  _btn(cls, text, title, onClick) {
    const b = document.createElement("button");
    b.className = "pte-btn " + cls;
    b.type = "button";
    b.textContent = text;
    b.title = title;
    b.tabIndex = -1;
    b.draggable = false;
    b.addEventListener("click", onClick);
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
          const i = this.tokens.indexOf(tok);
          if (i >= 0) this.tokens.splice(i, 1);
        } else {
          setTokenText(tok, v);
          tok.__trans = undefined; // テキストが変わったら旧翻訳は無効化
        }
        this._emit();
      }
      this.render();
      this._committing = false;
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commit(true); }
      else if (e.key === "Escape") { e.preventDefault(); commit(false); }
      e.stopPropagation();
    });
    input.addEventListener("blur", () => commit(true));
  }
}
