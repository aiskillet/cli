// The portability layer: turn one canonical skill (SKILL.md) into each
// target tool's native format + install location. Add a target = add a compiler.

import { homedir } from "node:os";
import { join } from "node:path";

export const TARGETS = ["claude-code", "cursor", "agents-md"];

/** Quote a value for single-line YAML only when needed. */
function yamlScalar(s) {
  const oneLine = String(s).replace(/\s+/g, " ").trim();
  return /[:#"'\[\]{}]|^\s|\s$/.test(oneLine) ? JSON.stringify(oneLine) : oneLine;
}

/**
 * Claude Code — SKILL.md / AGENT.md are already native formats.
 * Skills → .claude/skills/<name>/SKILL.md
 * Agents → .claude/agents/<name>.md
 * (--global installs under ~/.claude instead of the project.)
 */
function claudeCode(item, { global, cwd }) {
  const root = global ? join(homedir(), ".claude") : join(cwd, ".claude");
  if (item.type === "agent") {
    return [{ path: join(root, "agents", `${item.name}.md`), content: item.md }];
  }
  return [{ path: join(root, "skills", item.name, "SKILL.md"), content: item.md }];
}

/**
 * Cursor — project rules live in .cursor/rules/<name>.mdc with their own
 * frontmatter (description drives agent-requested activation).
 */
function cursor(skill, { cwd }) {
  const frontmatter =
    `---\n` +
    `description: ${yamlScalar(skill.description)}\n` +
    `alwaysApply: false\n` +
    `---\n\n`;
  return [
    { path: join(cwd, ".cursor", "rules", `${skill.name}.mdc`), content: frontmatter + skill.body + "\n" },
  ];
}

/**
 * AGENTS.md — the emerging cross-tool convention (Codex, Gemini CLI, etc.).
 * We write a per-skill file under .agents/skills and expect an AGENTS.md include;
 * for the MVP we emit the standalone skill file so it's portable.
 */
function agentsMd(item, { cwd }) {
  const folder = item.type === "agent" ? "agents" : "skills";
  const content = `# ${item.name}\n\n> ${item.description}\n\n${item.body}\n`;
  return [{ path: join(cwd, ".agents", folder, `${item.name}.md`), content }];
}

const COMPILERS = {
  "claude-code": claudeCode,
  cursor,
  "agents-md": agentsMd,
};

/** Compile a skill for a target → array of { path, content } to write. */
export function compile(target, skill, opts) {
  const fn = COMPILERS[target];
  if (!fn) {
    throw new Error(
      `Unsupported target "${target}". Supported: ${TARGETS.join(", ")}`
    );
  }
  return fn(skill, opts);
}
