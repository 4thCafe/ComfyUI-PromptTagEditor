"""翻訳バックエンド。argostranslate(オフライン/API不要)で各タグを翻訳する軽量ルート。

フロントの各チップの「訳」ボタンから
  POST /prompt_tag_editor/translate  {tags:[...], from:"en", to:"ja"}
で呼ばれ、{translations:[...]} を返す。言語パッケージ未導入時は初回のみ自動DL。
"""

import asyncio
import threading

from aiohttp import web

try:
    from server import PromptServer
except Exception:  # ComfyUI外(単体テスト等)
    PromptServer = None

try:
    import argostranslate.package as _pkg
    import argostranslate.translate as _tr
    _ARGOS_OK = True
except Exception:
    _ARGOS_OK = False

_install_lock = threading.Lock()
_ready_pairs = set()


def _clean(text):
    """翻訳前の正規化。プロンプトのエスケープ括弧を素の括弧へ戻す。"""
    return (
        (text or "")
        .replace("\\(", "(").replace("\\)", ")")
        .replace("\\[", "[").replace("\\]", "]")
        .strip()
    )


def _google_translate(tags, src, to):
    """deep-translator(Google, APIキー不要・要ネット)。高品質だが失敗し得る。"""
    from deep_translator import GoogleTranslator

    g = GoogleTranslator(source=src, target=to)
    out = []
    for t in tags:
        c = _clean(t)
        out.append(g.translate(c) if c else "")
    return out


def _ensure_pair(src, to):
    """(src,to) の argos 言語パッケージを用意(未導入なら取得・インストール)。"""
    key = (src, to)
    if key in _ready_pairs:
        return
    with _install_lock:
        if key in _ready_pairs:
            return
        installed = {(p.from_code, p.to_code) for p in _pkg.get_installed_packages()}
        if key not in installed:
            _pkg.update_package_index()
            avail = _pkg.get_available_packages()
            cand = [p for p in avail if p.from_code == src and p.to_code == to]
            if not cand:
                raise RuntimeError(f"argos package not found: {src}->{to}")
            _pkg.install_from_path(cand[0].download())
        _ready_pairs.add(key)


def _argos_translate(tags, src, to):
    """argostranslate(オフライン/API不要)。品質は控えめだがネット不要。"""
    _ensure_pair(src, to)
    out = []
    for t in tags:
        c = _clean(t)
        out.append(_tr.translate(c, src, to) if c else "")
    return out


def _translate_sync(tags, src, to):
    # まず Google(高品質・要ネット)、失敗時に argos(オフライン)へフォールバック
    try:
        return _google_translate(tags, src, to)
    except Exception as e:
        print(f"[PromptTagEditor] google translate failed, fallback to argos: {e}")
    if not _ARGOS_OK:
        raise RuntimeError("google failed and argostranslate not available")
    return _argos_translate(tags, src, to)


if PromptServer is not None:

    @PromptServer.instance.routes.post("/prompt_tag_editor/translate")
    async def _route_translate(request):
        try:
            data = await request.json()
        except Exception:
            return web.json_response({"error": "invalid json"}, status=400)

        tags = data.get("tags") or []
        src = data.get("from", "en")
        to = data.get("to", "ja")

        if not isinstance(tags, list):
            return web.json_response({"error": "tags must be a list"}, status=400)

        loop = asyncio.get_event_loop()
        try:
            # ブロッキング処理(初回DL/推論)はexecutorへ逃がしイベントループを止めない
            translations = await loop.run_in_executor(
                None, _translate_sync, tags, src, to
            )
            return web.json_response({"translations": translations})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)
