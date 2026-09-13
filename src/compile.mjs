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
 * Claude Code — SKILL.md is already the native format.
 * Project: <cwd>/.claude/skills/<name>/SKILL.md
 * Global:  ~/.claude/skills/<name>/SKILL.md
 */
function claudeCode(skill, { global, cwd }) {
  const base = global
    ? join(homedir(), ".claude", "skills")
    : join(cwd, ".claude", "skills");
  return [{ path: join(base, skill.name, "SKILL.md"), content: skill.md }];
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
function agentsMd(skill, { cwd }) {
  const content = `# ${skill.name}\n\n> ${skill.description}\n\n${skill.body}\n`;
  return [{ path: join(cwd, ".agents", "skills", `${skill.name}.md`), content }];
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
