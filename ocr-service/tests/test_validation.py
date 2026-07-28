import base64
import unittest
from pathlib import Path

from app.validation import ValidationError, resolve_local_image_path, validate_page_image_file

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "fixtures" / "test-page.png"


class TestValidation(unittest.TestCase):
    def test_resolve_image_path(self):
        resolved = resolve_local_image_path(str(FIXTURE), None)
        self.assertIsInstance(resolved, Path)
        self.assertTrue(resolved.is_file())

    def test_reject_missing_file(self):
        resolved = resolve_local_image_path("/nonexistent/file.png", None)
        self.assertIsInstance(resolved, Path)
        err = validate_page_image_file(resolved)
        self.assertIsInstance(err, ValidationError)
        self.assertEqual(err.code, "file_not_found")

    def test_accept_fixture_png(self):
        err = validate_page_image_file(FIXTURE)
        self.assertIsNone(err)

    def test_reject_bad_extension(self):
        resolved = resolve_local_image_path(__file__, None)
        err = validate_page_image_file(resolved)
        self.assertEqual(err.code, "unsupported_extension")


if __name__ == "__main__":
    unittest.main()
