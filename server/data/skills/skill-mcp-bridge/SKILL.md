# Skill : MCP Bridge (v1.0)

Runtime : `server/src/mcp/mcp-bridge.js`

## Mission
Connecter des serveurs MCP locaux de façon souveraine (sans dépendance cloud critique).

## Contrôles
- Valider chaque manifest (`name`, `version`, `tools`).
- Fail-closed si `MCP_DISABLED=true`.
- Journaliser stderr des processus MCP.

## Modules
- `validateMcpManifest`, `registerMcpServers`, `connectMcpServer`, `callMcpTool`
