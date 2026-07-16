// prompt_parser.js — プロンプト文字列のトークナイズ/シリアライズ/重み調整(純ロジック)
// ComfyUI-PromptTagEditor / 4thCafe
//
// 方針:
//  - カンマ単純splitは禁止。エスケープ `\` と括弧深度を見て、深度0のカンマ/改行のみで分割する。
//  - 各トークンは raw(元の文字列)を保持。未編集トークンは serialize で raw をそのまま出力し無損失。
//    重み/テキストを編集したトークンのみ dirty=true とし {text,weight} から再構築する。

let _idCounter = 0;
function nextId() {
  return `pte_${(++_idCounter).toString(36)}`;
}

// 重みを小数2桁へ丸める
function round2(n) {
  return Math.round(n * 100) / 100;
}

const WEIGHT_EPS = 0.001;

// 単一トークン文字列を構造化する
export function parseToken(raw) {
  const text = raw.trim();
  const token = {
    id: nextId(),
    text,
    weight: 1.0,
    type: "tag",
    raw: text,
    dirty: false,
  };
  if (text === "") return token;

  // BREAK(独立トークン)
  if (text === "BREAK") {
    token.type = "break";
    return token;
  }
  // コメント
  if (text.startsWith("#")) {
    token.type = "comment";
    return token;
  }
  // ネットワーク系 <lora:name:1.0> / <lyco:...> など
  const net = text.match(/^<([a-zA-Z_]+):([^:>]+)(?::([-\d.]+))?>$/);
  if (net) {
    token.type = "lora";
    if (net[3] !== undefined) {
      const w = parseFloat(net[3]);
      if (!isNaN(w)) token.weight = w;
    }
    return token;
  }
  // 明示重み (content:weight) — 最外殻が括弧で閉じ、末尾が :数値) の形
  const weighted = matchOuterWeighted(text);
  if (weighted) {
    token.text = weighted.text;
    token.weight = weighted.weight;
    token.type = "tag";
    return token;
  }
  // 暗黙強調 (word)=1.1^n / [word]=(1/1.1)^n
  const emph = matchImplicitEmphasis(text);
  if (emph) {
    token.text = emph.text;
    token.weight = round2(emph.weight);
    token.type = "tag";
    return token;
  }
  // 素のタグ
  token.text = text;
  return token;
}

// `(...:number)` が全体を1つの重み括弧で包んでいるか判定(内部の括弧バランスも確認)
function matchOuterWeighted(text) {
  if (text[0] !== "(" || text[text.length - 1] !== ")") return null;
  // 末尾の :number) を探す
  const m = text.match(/:\s*([-+]?\d*\.?\d+)\s*\)$/);
  if (!m) return null;
  const inner = text.slice(1, text.length - m[0].length); // ( と :num) を除いた中身
  // 最外殻の括弧が全体を包んでいる(途中で深度が0に戻らない)ことを確認
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\") { i++; continue; }
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0 && i !== text.length - 1) return null; // 途中で閉じている→最外殻ではない
    }
  }
  const weight = parseFloat(m[1]);
  if (isNaN(weight)) return null;
  return { text: inner.trim(), weight: round2(weight) };
}

// (((word))) / [[word]] のような暗黙強調
function matchImplicitEmphasis(text) {
  let open = 0, close = 0;
  let mult = 1.0;
  // 先頭・末尾の対応する括弧の層数を数える
  let s = text;
  // 括弧の種類が混在する複雑ケースは扱わず null(raw温存)
  const first = s[0];
  if (first !== "(" && first !== "[") return null;
  const bracket = first === "(" ? { o: "(", c: ")", w: 1.1 } : { o: "[", c: "]", w: 1 / 1.1 };
  let n = 0;
  while (s[n] === bracket.o) n++;
  let m = 0;
  while (s[s.length - 1 - m] === bracket.c) m++;
  const layers = Math.min(n, m);
  if (layers === 0) return null;
  const inner = s.slice(layers, s.length - layers).trim();
  if (inner === "" || inner.includes(bracket.o) || inner.includes(bracket.c)) return null;
  // 中身にコロン重みが混ざる場合は扱わない
  if (/[:()\[\]<>]/.test(inner)) return null;
  mult = Math.pow(bracket.w, layers);
  return { text: inner, weight: mult };
}

// プロンプト文字列 -> Token[](深度0のカンマ/改行のみで分割)
export function tokenize(str) {
  const tokens = [];
  if (!str) return tokens;
  let buf = "";
  let depth = 0;
  const flush = () => {
    if (buf.trim() !== "") tokens.push(parseToken(buf));
    buf = "";
  };
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === "\\") {
      buf += ch;
      if (i + 1 < str.length) { buf += str[i + 1]; i++; }
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "<") { depth++; buf += ch; continue; }
    if (ch === ")" || ch === "]" || ch === ">") { depth = Math.max(0, depth - 1); buf += ch; continue; }
    if ((ch === "," || ch === "\n") && depth === 0) { flush(); continue; }
    buf += ch;
  }
  flush();
  return tokens;
}

// 単一トークンを文字列化
export function serializeToken(t) {
  if (t.type === "break") return "BREAK";
  // 未編集トークンは raw をそのまま(無損失)
  if (!t.dirty) return t.raw;
  // 編集済み: 構造から再構築
  if (t.type === "lora") {
    return t.raw; // MVPではlora本体は編集対象外
  }
  if (t.type === "comment") return t.raw;
  const w = t.weight;
  if (Math.abs(w - 1.0) < WEIGHT_EPS) return t.text;
  return `(${t.text}:${round2(w)})`;
}

// Token[] -> プロンプト文字列
export function serialize(tokens) {
  return tokens
    .map(serializeToken)
    .filter((s) => s !== "" && s != null)
    .join(", ");
}

// 重みを delta だけ増減(0.05刻み想定)。tagのみ対象。1.0近傍で括弧自動除去。
export function adjustWeight(token, delta) {
  if (token.type !== "tag") return token;
  let w = round2(token.weight + delta);
  if (Math.abs(w - 1.0) < 0.03) w = 1.0; // 1.0近傍でスナップ(unwrap)
  w = Math.max(0, Math.min(5, w));
  token.weight = w;
  token.dirty = true;
  return token;
}

// テキスト編集を反映
export function setTokenText(token, newText) {
  token.text = newText;
  token.dirty = true;
  return token;
}

// 表示用ラベル(チップに出す文字列)
export function displayLabel(t) {
  if (t.type === "break") return "BREAK";
  if (t.type === "lora") return t.raw;
  if (t.type === "comment") return t.raw;
  if (Math.abs(t.weight - 1.0) < WEIGHT_EPS) return t.text;
  return `${t.text}:${round2(t.weight)}`;
}
