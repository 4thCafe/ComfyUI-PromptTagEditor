"""ComfyUI-PromptTagEditor / 4thCafe

既存ノードの multiline STRING 入力欄を、フロントエンド拡張でタグ(チップ)単位編集できるように強化する。
Pythonノードは追加しない(WEB_DIRECTORY の JS 拡張のみ)。
"""

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}
WEB_DIRECTORY = "./js"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
