// translate.js — バックエンド翻訳ルートの呼び出し
// ComfyUI-PromptTagEditor / 4thCafe

import { api } from "../../scripts/api.js";

// tags(文字列配列)を from→to 翻訳して返す。失敗時は null。
export async function translateTags(tags, from = "en", to = "ja") {
  try {
    const resp = await api.fetchApi("/prompt_tag_editor/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags, from, to }),
    });
    if (!resp.ok) {
      console.warn("[PromptTagEditor] translate HTTP", resp.status);
      return null;
    }
    const data = await resp.json();
    return Array.isArray(data.translations) ? data.translations : null;
  } catch (e) {
    console.warn("[PromptTagEditor] translate failed:", e);
    return null;
  }
}
