#!/usr/bin/env python3
"""
Test unitaire automatisé pour le parseur SEARCH/REPLACE d'Async Forge v0.3.
"""

import os
import shutil
import unittest
import sys

# Ajouter le dossier parent au PATH pour l'import de run_async_forge
sys.path.append(os.path.abspath(os.path.dirname(__file__)))
import run_async_forge

class TestSearchReplaceParser(unittest.TestCase):
    def setUp(self):
        self.test_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_sandbox"))
        os.makedirs(self.test_dir, exist_ok=True)
        
        # Création d'un fichier source de test
        self.source_file = os.path.join(self.test_dir, "utils.js")
        with open(self.source_file, "w", encoding="utf-8") as f:
            f.write(
                "function add(a, b) {\n"
                "    return a + b;\n"
                "}\n"
                "\n"
                "function subtract(a, b) {\n"
                "    return a - b;\n"
                "}\n"
            )

    def tearDown(self):
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_successful_exact_replace(self):
        llm_output = (
            "FILE: utils.js\n"
            "<<<<<<< SEARCH\n"
            "function add(a, b) {\n"
            "    return a + b;\n"
            "}\n"
            "=======\n"
            "function add(a, b) {\n"
            "    // Addition de deux nombres\n"
            "    return a + b;\n"
            "}\n"
            ">>>>>>> REPLACE\n"
        )
        
        success, total, errors = run_async_forge.apply_search_replace_mutations(self.test_dir, llm_output)
        self.assertEqual(success, 1)
        self.assertEqual(total, 1)
        self.assertEqual(len(errors), 0)
        
        with open(self.source_file, "r", encoding="utf-8") as f:
            content = f.read()
            self.assertIn("// Addition de deux nombres", content)

    def test_file_creation(self):
        llm_output = (
            "FILE: helper.js\n"
            "<<<<<<< SEARCH\n"
            "=======\n"
            "export const greet = name => `Hello ${name}!`;\n"
            ">>>>>>> REPLACE\n"
        )
        
        new_file_path = os.path.join(self.test_dir, "helper.js")
        self.assertFalse(os.path.exists(new_file_path))
        
        success, total, errors = run_async_forge.apply_search_replace_mutations(self.test_dir, llm_output)
        self.assertEqual(success, 1)
        self.assertEqual(total, 1)
        self.assertTrue(os.path.exists(new_file_path))
        
        with open(new_file_path, "r", encoding="utf-8") as f:
            self.assertEqual(f.read(), "export const greet = name => `Hello ${name}!`;\n")

    def test_mismatch_error(self):
        llm_output = (
            "FILE: utils.js\n"
            "<<<<<<< SEARCH\n"
            "function multiply(a, b) {\n"
            "    return a * b;\n"
            "}\n"
            "=======\n"
            "// n'importe quoi\n"
            ">>>>>>> REPLACE\n"
        )
        
        success, total, errors = run_async_forge.apply_search_replace_mutations(self.test_dir, llm_output)
        self.assertEqual(success, 0)
        self.assertEqual(total, 1)
        self.assertEqual(len(errors), 1)
        self.assertIn("ne correspond pas exactement", errors[0])

    def test_path_traversal_protection(self):
        llm_output = (
            "FILE: ../outside.js\n"
            "<<<<<<< SEARCH\n"
            "=======\n"
            "hack();\n"
            ">>>>>>> REPLACE\n"
        )
        
        success, total, errors = run_async_forge.apply_search_replace_mutations(self.test_dir, llm_output)
        self.assertEqual(success, 0)
        self.assertEqual(total, 1)
        self.assertEqual(len(errors), 1)
        self.assertIn("sort des limites de la sandbox", errors[0])

if __name__ == "__main__":
    unittest.main()
