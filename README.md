# 🍳 skillet

The CLI for [AISkillet](https://aiskillet.com) — install AI skills from the marketplace into **whatever tool you already use**. Write a capability once; `skillet` compiles it into each tool's native format.

```bash
npx @aiskillet/cli search api
npx @aiskillet/cli add api-design --target cursor
npx @aiskillet/cli add api-design --target claude-code --global
```

## Why

A skill written once should run everywhere. `skillet` is the portability layer: it fetches a skill's canonical `SKILL.md` from its source repo and **compiles** it to the target tool's format + install location — no copy-paste, no reformatting.

| Target | Output | Location |
|---|---|---|
| `claude-code` | native `SKILL.md` | `.claude/skills/<name>/` (or `~/.claude/skills` with `--global`) |
| `cursor` | `.mdc` rule with Cursor frontmatter | `.cursor/rules/<name>.mdc` |
| `agents-md` | portable `AGENTS.md`-style skill | `.agents/skills/<name>.md` |
| `agentvoy` | reusable agent instructions for an [AgentVoy](https://github.com/agentvoy/agentvoy) project | `skills/<name>.md` |

We never execute the skill — we only read Markdown. The code stays in its source repo.

## Commands

```
skillet search [query]              Search the marketplace
skillet add <name> --target <t>     Compile + install a skill for a target
skillet list                        List skills installed in this directory
skillet remove <name> [--target t]  Remove an installed skill
skillet targets                     List supported targets
```

### Options
- `-t, --target <name>` — target tool (`claude-code`, `cursor`, `agents-md`)
- `-g, --global` — install for the user (e.g. `~/.claude`) instead of the project
- `--registry <url>` — registry `index.json` URL or local path (env: `SKILLET_REGISTRY`)
- `--cwd <dir>` — project directory to install into

## Install

```bash
npm install -g @aiskillet/cli
# or run without installing:
npx @aiskillet/cli <command>
```

Requires Node 20+. Zero runtime dependencies.

## Roadmap

- **Now:** portability/compiler — write once, install into any tool.
- **Next:** `skillet run <agent>` — run marketplace agents locally against any model (bring-your-own-key) with MCP tools.

MIT licensed.
