"""ComfyUI-PromptTagEditor / 4thCafe

タグ(チップ)単位でプロンプトを編集できる専用ノードを提供する。
チップUIはこの拡張が追加する `PromptTagEditor` ノードの text 欄にのみ適用され、
既存の他ノード(CLIP Text Encode / Note など)には一切影響しない。
"""


class PromptTagEditorNode:
    """タグ編集用の汎用プロンプトノード。text をそのまま STRING で出力する。

    フロントエンド拡張(js/)が、このノードの text ウィジェット直下に
    タグ(チップ)編集エリアを表示する。
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"multiline": True, "default": ""}),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "run"
    CATEGORY = "utils/prompt"

    def run(self, text):
        return (text,)


NODE_CLASS_MAPPINGS = {
    "PromptTagEditor": PromptTagEditorNode,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "PromptTagEditor": "Prompt Tag Editor 🏷️",
}
WEB_DIRECTORY = "./js"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
