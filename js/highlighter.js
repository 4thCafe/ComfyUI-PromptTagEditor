// highlighter.js — textarea の構文ハイライト
// 素の textarea は色付け不可のため、同じ親内に色付きバックドロップdivを敷き、
// textarea の文字を透明化(キャレットのみ表示)して重ねる方式。座標追従はComfyUIに委譲。
// ComfyUI-PromptTagEditor / 4thCafe

import { parseToken } from "./prompt_parser.js";

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// セグメント(カンマ区切りの1タグ)の種別からCSSクラスを決める
function classOf(seg) {
  const t = seg.trim();
  if (!t) return null;
  const tok = parseToken(t);
  if (tok.type === "lora") return "pte-hl-lora";
  if (tok.type === "break") return "pte-hl-break";
  if (tok.type === "comment") return "pte-hl-comment";
  if (tok.type === "tag" && Math.abs(tok.weight - 1) > 0.001) return "pte-hl-weighted";
  return null; // 通常タグ(既定色)
}

// プロンプト文字列 → 色付きHTML(全文字を保持。深度0のカンマ/改行で区切る)
export function highlightHTML(text) {
  if (!text) return "";
  let html = "";
  let buf = "";
  let depth = 0;
  const flush = () => {
    if (buf === "") return;
    const cls = classOf(buf);
    html += cls ? `<span class="${cls}">${escapeHtml(buf)}</span>` : escapeHtml(buf);
    buf = "";
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\") { buf += ch; if (i + 1 < text.length) { buf += text[i + 1]; i++; } continue; }
    if (ch === "(" || ch === "[" || ch === "<") { depth++; buf += ch; continue; }
    if (ch === ")" || ch === "]" || ch === ">") { depth = Math.max(0, depth - 1); buf += ch; continue; }
    if ((ch === "," || ch === "\n") && depth === 0) { flush(); html += escapeHtml(ch); continue; }
    buf += ch;
  }
  flush();
  return html;
}

export class Highlighter {
  constructor(textarea) {
    this.ta = textarea;
    try {
      this._build();
      this._bind();
      this.update();
    } catch (e) {
      console.warn("[PromptTagEditor] highlighter init failed:", e);
    }
  }

  _build() {
    const ta = this.ta;
    const parent = ta.parentElement;
    const cs = getComputedStyle(ta);
    this._origColor = cs.color;

    const bd = document.createElement("div");
    bd.className = "pte-hl-backdrop";
    const s = bd.style;
    s.position = "absolute";
    s.margin = "0";
    s.borderWidth = cs.borderWidth;
    s.borderStyle = "solid";
    s.borderColor = "transparent";
    s.padding = cs.padding;
    s.font = cs.font;
    s.lineHeight = cs.lineHeight;
    s.letterSpacing = cs.letterSpacing;
    s.whiteSpace = "pre-wrap";
    s.overflowWrap = "break-word";
    s.wordBreak = cs.wordBreak;
    s.boxSizing = cs.boxSizing;
    s.overflow = "hidden";
    s.pointerEvents = "none";
    s.color = cs.color;
    parent.insertBefore(bd, ta);
    this.bd = bd;

    // バックドロップ位置・サイズを textarea の offset ボックスに合わせる(ズーム非依存)
    this._syncBox = () => {
      s.top = ta.offsetTop + "px";
      s.left = ta.offsetLeft + "px";
      s.width = ta.offsetWidth + "px";
      s.height = ta.offsetHeight + "px";
    };
    this._syncBox();
    try {
      this._ro = new ResizeObserver(() => this._syncBox());
      this._ro.observe(ta);
    } catch (_) {}

    // textarea の文字を透明化(キャレットは元色で表示)
    ta.style.background = "transparent";
    ta.style.color = "transparent";
    ta.style.caretColor = this._origColor || "#fff";
    ta.style.position = "relative";
    ta.style.zIndex = "1";
  }

  _bind() {
    this._onInput = () => this.update();
    this._onScroll = () => this._syncScroll();
    this.ta.addEventListener("input", this._onInput);
    this.ta.addEventListener("scroll", this._onScroll);
  }

  _syncScroll() {
    if (!this.bd) return;
    this.bd.scrollTop = this.ta.scrollTop;
    this.bd.scrollLeft = this.ta.scrollLeft;
  }

  update() {
    if (!this.bd) return;
    if (this._syncBox) this._syncBox();
    this.bd.innerHTML = highlightHTML(this.ta.value);
    this._syncScroll();
  }
}
