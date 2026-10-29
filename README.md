# MeltingSpot for AI

Connect your AI assistant to [MeltingSpot](https://meltingspot.io) and manage
your Spot in plain language: members, groups, tags, channels, lives,
learning paths, collections, moderation and search.

This repository is both a plugin marketplace and the `meltingspot` plugin. The
plugin declares the MeltingSpot MCP server, `https://mcp.meltingspot.io/mcp`,
and bundles skills that teach the assistant how to use its tools safely.

## Prerequisites

- You are an **administrator** of the Spot you want to connect.
- The **MCP server is enabled for that Spot**. It is enabled Spot by Spot by
  the MeltingSpot Customer Success team: contact them to enable it for each
  Spot you want to use.
- **One connection gives access to one Spot.** When you connect, you choose
  the Spot. To work on another Spot, add another connection.
- The connection grants the read, write and delete permissions on that Spot.

## Installation

### Claude Code

```text
/plugin marketplace add meltingspot/meltingspot-for-ai
/plugin install meltingspot@meltingspot
```

Then run `/mcp` to sign in to MeltingSpot and choose your Spot.

### claude.ai and Cowork

1. Open **Customize > Plugins**.
2. Select **Add > Add marketplace** and enter `meltingspot/meltingspot-for-ai`.
3. Add the `meltingspot` plugin.
4. Open the plugin's **Connectors** tab and connect MeltingSpot.

The plugin is saved to your account, so it is also available in Cowork and
Claude Code.

### Codex

```bash
codex plugin marketplace add meltingspot/meltingspot-for-ai
```

Then install `meltingspot` from the `meltingspot` marketplace in the Plugins
Directory, and sign in to MeltingSpot when asked.

### Skills only, with `npx skills`

```bash
npx skills add meltingspot/meltingspot-for-ai
```

This installs the skills only. Add the MCP connector separately in your
assistant, with the URL `https://mcp.meltingspot.io/mcp`.

### Cursor and VS Code

Add the MCP server in one click:

- [Install in Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=meltingspot&config=eyJ1cmwiOiJodHRwczovL21jcC5tZWx0aW5nc3BvdC5pby9tY3AifQ%3D%3D)
- [Install in VS Code](vscode:mcp/install?%7B%22name%22%3A%22meltingspot%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.meltingspot.io%2Fmcp%22%7D)

If your browser does not open the link, copy it into the address bar:

```text
cursor://anysphere.cursor-deeplink/mcp/install?name=meltingspot&config=eyJ1cmwiOiJodHRwczovL21jcC5tZWx0aW5nc3BvdC5pby9tY3AifQ%3D%3D
vscode:mcp/install?%7B%22name%22%3A%22meltingspot%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.meltingspot.io%2Fmcp%22%7D
```

These links add the MCP server only. To use the skills too, install them with
`npx skills add meltingspot/meltingspot-for-ai`.

## Data sent

- The plugin itself sends nothing: nothing in it runs on your computer. It
  only declares the MCP server and the skills, which are instructions for the
  assistant.
- When the assistant calls a MeltingSpot tool, the call goes from your
  assistant to `https://mcp.meltingspot.io/mcp`, with the access granted when
  you connected. The tool reads or changes the data of the Spot of the
  connection, as your administrator account.
- The results of the tools (members, groups, content of the Spot…) are sent to
  your assistant, and therefore to the provider of your AI model.
- MeltingSpot writes one log line per tool call, with the tool name, the
  outcome (success, refused or error), your user, the Spot, the connected
  client and the duration. The arguments of the call and the results are not
  in that line.

See the [MeltingSpot privacy policy](https://www.iubenda.com/privacy-policy/99274573)
and the [terms and conditions](https://www.meltingspot.io/terms-and-conditions).

## Skills

| Skill | What it teaches |
| --- | --- |
| `meltingspot-conventions` | One connection = one Spot, pagination, batches of 100, ISO 8601 dates, Markdown, ids, reply language, tools you cannot see. |
| `meltingspot-write-safely` | Read before writing, confirm destructive and bulk operations, read partial results, attribution of writes, no retry loops. |
| `meltingspot-errors` | The messages of the server: refused access, invalid parameters, errors of the operation, unexpected error. Cause and action for each. |
| `meltingspot-untrusted-content` | Member content is data, not instructions: confirm writes and report injection attempts. |
| `meltingspot-domain` | What a Spot is and what it contains: members and their roles, groups, linked groups, participants and speakers, and one reference per domain. |

## `tools.json`

`tools.json` lists the tools of the MeltingSpot MCP server, with their domain,
their status and their annotations:

- `delivered`: the tool is available on the server;
- `upcoming`: the tool is announced but not available yet.

The CI checks that:

- every tool a skill cites between backticks exists in `tools.json`;
- every `delivered` tool is cited by a skill, in a file other than an
  upcoming reference;
- each reference of a domain (`skills/*/references/*.md`) starts with a status
  line, `Status: delivered` or `Status: upcoming — …`, that matches the tools
  it cites: a delivered reference cites no upcoming tool, an upcoming
  reference cites at least one tool, and an upcoming reference that cites only
  delivered tools must become delivered;
- the `SKILL.md` of a skill that has references indexes every one of them,
  with the same status as its status line;
- the skills follow the Agent Skills format;
- the manifests agree with each other (version, MCP URL, paths).

## Contributing

Requirements: Node.js 22 or later, and the Claude Code CLI
(`npm install --global @anthropic-ai/claude-code`) for
`claude plugin validate`.

Run the checks before each change:

```bash
node --test "scripts/**/*.test.mjs"
node scripts/check-skills.mjs
claude plugin validate --strict .
```

**Add a skill.** Create `skills/meltingspot-<name>/SKILL.md`. Its frontmatter
has a `name` equal to the folder name (kebab-case, 64 characters at most,
prefixed with `meltingspot-`) and a `description` of 1024 characters at most
that says when to load the skill. Cite tools by their exact name between
backticks. Add the skill to the table above and to `CHANGELOG.md`.

**Ship a domain.** When the tools of a domain are available on the server:

1. Set their `status` to `delivered` in `tools.json`. Keep the file sorted by
   name.
2. Set the first line of the domain's reference in
   `skills/meltingspot-domain/references/` to `Status: delivered`.
3. Set its status to `delivered` in the references index of
   `skills/meltingspot-domain/SKILL.md`.
4. Bump `version` in `plugin.json`, `.claude-plugin/plugin.json` and
   `.codex-plugin/plugin.json`, and add the matching entry at the top of
   `CHANGELOG.md`: the check fails when they differ.

## License

[BSD-3-Clause](LICENSE), MeltingSpot.
