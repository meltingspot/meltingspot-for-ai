# Changelog

All notable changes to this plugin are documented here. Versions follow the
`version` field of the manifests.

## 0.1.0 - 2026-10-28

### Added

- Marketplace `meltingspot` and plugin `meltingspot`, with manifests for
  Claude Code, claude.ai and Cowork (`.claude-plugin/`), Codex
  (`.codex-plugin/`, `.agents/plugins/`) and the portable format (`mcp.json`).
- MeltingSpot MCP server `https://mcp.meltingspot.io/mcp`.
- Skills `meltingspot-conventions`, `meltingspot-write-safely`,
  `meltingspot-errors` and `meltingspot-untrusted-content`.
- `tools.json`: the 62 delivered tools and the 38 upcoming tools (forums,
  topics, courses, learning paths).
- `scripts/check-skills.mjs` and its tests, run by the GitHub CI.
