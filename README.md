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
- `-t, --target <name>` — target tool (`claude-code`, `cursor`, `agents-md`, `agentvoy`)
- `-g, --global` — install for the user (e.g. `~/.claude`) instead of the project
- `-f, --force` — overwrite / remove even if the file was locally modified
- `--registry <url>` — registry `index.json` URL or local path (env: `SKILLET_REGISTRY`)
- `--cwd <dir>` — project directory to install into

## Bring your own repo (no marketplace required)

AISkillet isn't a walled garden. Install a skill or agent **straight from any public repo** — no listing, no PR. Your code stays in your repo; we only read the Markdown.

```bash
skillet add owner/repo --target cursor                      # SKILL.md / AGENT.md at repo root
skillet add owner/repo/path/to/skill --target claude-code   # a subpath
skillet add owner/repo/path@<commit-sha> --target agentvoy  # pin an exact commit
skillet add https://github.com/owner/repo/tree/main/skills/x --target cursor
```

It tries `SKILL.md`, then `AGENT.md`. Pin a commit with `@<sha>` to install exactly that revision.

## Same skills on every machine

You don't sync files between PCs — you *reproduce* from the registry, like `npm install` vs. copying `node_modules`. skillet records what you install in a manifest (`.skillet/installed.json`). Commit it to your dotfiles/repo, then on any new machine:

```bash
skillet install    # replays every install from the manifest — same skills, any tool, any PC
```

## Your local edits are protected

skillet records a content hash at install. If you edit an installed skill locally, a later `add` **won't silently overwrite it** and `remove` **won't delete it** — both skip with a warning. Use `--force` to override.

## Private / self-hosted registry

Run your own catalog for a team or private marketplace — just host an `index.json` (same shape as `aiskillet.com/index.json`) and point `skillet` at it:

```bash
export SKILLET_REGISTRY=https://skills.yourco.com/index.json
skillet search
# or per-command:
skillet add internal-skill --registry https://skills.yourco.com/index.json --target cursor
```

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
