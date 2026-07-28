import unittest

from app.constants import PAGE_PROMPT
from app.infer_recipe import (
    assert_page_prompt_valid,
    build_page_infer_kwargs,
    official_page_recipe_snapshot,
)


class TestInferRecipe(unittest.TestCase):
    def test_page_prompt_literal_image_prefix(self):
        self.assertTrue(PAGE_PROMPT.startswith("<image>"))
        assert_page_prompt_valid()

    def test_build_page_infer_kwargs_matches_official_snapshot(self):
        kw = build_page_infer_kwargs(image_file="/tmp/x.png", output_path="/tmp/out")
        snap = official_page_recipe_snapshot()
        for key in (
            "base_size",
            "image_size",
            "crop_mode",
            "max_length",
            "no_repeat_ngram_size",
            "ngram_window",
            "save_results",
        ):
            self.assertEqual(kw[key], snap[key], key)
        self.assertEqual(kw["prompt"], snap["prompt"])
        self.assertTrue(kw["prompt"].startswith("<image>"))

    def test_reject_prompt_without_image_prefix(self):
        with self.assertRaises(ValueError):
            build_page_infer_kwargs(
                image_file="/tmp/x.png",
                output_path="/tmp/out",
                prompt="document parsing.",
            )


if __name__ == "__main__":
    unittest.main()
