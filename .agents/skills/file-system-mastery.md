# Skill: File System Mastery

## Purpose
Enable the agent to physically construct project architectures on the local disk through the `projectBuilder` tool.

## Rules
1. **Safety First**: Never overwrite existing project files without explicit confirmation unless in a temporary `projects/` directory.
2. **Structure Precision**:
    - Always create the root project folder first.
    - Follow standard naming conventions (kebab-case for folders).
    - Ensure directories are created before writing files.
3. **Architecture Quality**:
    - Enforce clean directory structures (e.g., `src/`, `data/`, `tests/`).
    - automatically create a `README.md` and `.gitignore` for every new project.

## Tooling
- Use `fs-extra` for server-side operations.
- Report physical file paths clearly in terminal logs.
