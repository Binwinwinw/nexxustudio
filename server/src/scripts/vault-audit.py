import os
import re

vault_path = r'd:\Hostinger\public_html\nexxustudio\citadelle-vault\Citadelle'
markdown_files = []

# Collect all markdown files
for root, dirs, files in os.walk(vault_path):
    for file in files:
        if file.endswith('.md'):
            markdown_files.append(os.path.join(root, file))

# Map basenames to full paths
file_inventory = {}
for path in markdown_files:
    basename = os.path.splitext(os.path.basename(path))[0]
    if basename not in file_inventory:
        file_inventory[basename] = []
    file_inventory[basename].append(path)

# Extract links from all files
links_found = set()
link_pattern = re.compile(r'\[\[([^\]|]+)(?:\|[^\]]+)?\]\]')

for path in markdown_files:
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            matches = link_pattern.findall(content)
            for match in matches:
                # Obsidian links can have paths or just basenames
                link_target = match.split('/')[-1]
                links_found.add(link_target)
    except Exception as e:
        print(f"Error reading {path}: {e}")

# Identify orphans (files not linked by anyone)
# Special case: Bienvenue.md is the root, not an orphan
orphans = []
for basename, paths in file_inventory.items():
    if basename == 'Bienvenue':
        continue
    if basename not in links_found:
        orphans.append(basename)

# Identify broken links
broken_links = []
for link in links_found:
    if link not in file_inventory:
        broken_links.append(link)

print("--- ORPHANS (Basenames) ---")
for o in sorted(orphans):
    print(o)

print("\n--- BROKEN LINKS ---")
for b in sorted(broken_links):
    print(b)
