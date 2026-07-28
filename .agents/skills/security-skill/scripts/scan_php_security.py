#!/usr/bin/env python3
"""
scan_php_security.py — Analyse statique sécurité PHP & JS (MonCoachScolaire)

Fonctionnalités :
- Détecte patterns dangereux PHP (eval, exec, system, ...)
- Cherche variables non échappées dans les echo/print
- Détecte accès fichiers risqués (fopen, unlink, ...)
- Scanne JS : eval, Function, innerHTML, document.write, setTimeout/setInterval dynamiques
"""
import os
import re

DANGEROUS_PHP = [r'eval\s*\(', r'exec\s*\(', r'system\s*\(', r'shell_exec\s*\(', r'passthru\s*\(', r'base64_decode\s*\(', r'unserialize\s*\(', r'mysql_query\s*\(', r'mysqli_query\s*\(', r'\$_GET\[', r'\$_POST\[', r'\$_REQUEST\[']
DANGEROUS_FILE = [r'fopen\s*\(', r'file_put_contents\s*\(', r'file_get_contents\s*\(', r'unlink\s*\(', r'copy\s*\(', r'move_uploaded_file\s*\(']
DANGEROUS_JS = [
    r'eval\s*\(',
    r'Function\s*\(',
    r'innerHTML\s*=',
    r'document\.write\s*\(',
    r'setTimeout\s*\(\s*[^\'\"]',  # setTimeout sans string safe
    r'setInterval\s*\(\s*[^\'\"]',
]

REPORT = []

def scan_file(filepath, patterns, label):
    """
    Scanne un fichier ligne par ligne pour chaque pattern donné.
    Ajoute au rapport si un pattern est trouvé.
    """
    with open(filepath, encoding='utf-8', errors='ignore') as f:
        for i, line in enumerate(f, 1):
            for pat in patterns:
                if re.search(pat, line):
                    REPORT.append(f"{label}: {filepath}:{i}: {line.strip()}")

def scan_php_echo(filepath):
    """
    Détecte les echo/print de variables superglobales non échappées (XSS potentiel).
    """
    with open(filepath, encoding='utf-8', errors='ignore') as f:
        for i, line in enumerate(f, 1):
            if re.search(r'echo|print', line):
                # Cherche variables non échappées (très basique)
                if re.search(r'\$_(GET|POST|REQUEST|COOKIE)\[', line) and 'htmlspecialchars' not in line:
                    REPORT.append(f"[PHP][UNESCAPED ECHO]: {filepath}:{i}: {line.strip()}")

def walk_dir(root, ext, scan_funcs):
    """
    Parcourt récursivement un dossier et applique les fonctions de scan à chaque fichier d'extension donnée.
    """
    for dirpath, _, files in os.walk(root):
        for f in files:
            if f.endswith(ext):
                fp = os.path.join(dirpath, f)
                for func in scan_funcs:
                    func(fp)

def main():
    # Scan PHP
    walk_dir('../../src', '.php', [
        lambda fp: scan_file(fp, DANGEROUS_PHP, '[PHP][DANGEROUS]'),
        lambda fp: scan_file(fp, DANGEROUS_FILE, '[PHP][FILE]'),
        scan_php_echo
    ])
    # Scan JS
    walk_dir('../../public/assets/js', '.js', [
        lambda fp: scan_file(fp, DANGEROUS_JS, '[JS][DANGEROUS]')
    ])
    print('\n'.join(REPORT) or 'Aucune vulnérabilité critique détectée.')

if __name__ == '__main__':
    main()
