import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter, parseRepo } from "../src/source.mjs";
import { compile } from "../src/compile.mjs";

test("parseFrontmatter extracts name + description and body", () => {
  const { data, body } = parseFrontmatter(
    "---\nname: x\ndescription: hello world\n---\n# Body\ntext"
  );
  assert.equal(data.name, "x");
  assert.equal(data.description, "hello world");
  assert.match(body, /# Body/);
});

test("parseFrontmatter tolerates missing frontmatter", () => {
  const { data, body } = parseFrontmatter("# Just markdown");
  assert.deepEqual(data, {});
  assert.equal(body, "# Just markdown");
});

test("parseRepo splits owner/repo and strips .git", () => {
  assert.deepEqual(parseRepo("https://github.com/aiskillet/cookbook.git"), {
    owner: "aiskillet",
    repo: "cookbook",
  });
});

test("compile → cursor produces .mdc and quotes a description with a colon", () => {
  const skill = { name: "x", description: "does: things", body: "# Hi", md: "raw" };
  const [file] = compile("cursor", skill, { cwd: "/tmp/p" });
  assert.match(file.path, /\.cursor\/rules\/x\.mdc$/);
  assert.match(file.content, /alwaysApply: false/);
  assert.match(file.content, /description: "does: things"/); // quoted → valid YAML
});

test("compile → claude-code writes the native SKILL.md verbatim", () => {
  const skill = { name: "x", description: "d", body: "b", md: "RAW-NATIVE" };
  const [file] = compile("claude-code", skill, { cwd: "/tmp/p" });
  assert.match(file.path, /\.claude\/skills\/x\/SKILL\.md$/);
  assert.equal(file.content, "RAW-NATIVE");
});

test("compile → claude-code --global targets the home dir", () => {
  const [file] = compile("claude-code", { name: "x", md: "m" }, { cwd: "/tmp/p", global: true });
  assert.match(file.path, /\.claude\/skills\/x\/SKILL\.md$/);
  assert.doesNotMatch(file.path, /\/tmp\/p/);
});

test("compile → claude-code installs an agent under .claude/agents", () => {
  const item = { name: "pr-reviewer", type: "agent", md: "AGENT-RAW", body: "b", description: "d" };
  const [file] = compile("claude-code", item, { cwd: "/tmp/p" });
  assert.match(file.path, /\.claude\/agents\/pr-reviewer\.md$/);
  assert.equal(file.content, "AGENT-RAW");
});

test("fileNameFor picks AGENT.md for agents, SKILL.md otherwise", async () => {
  const { fileNameFor } = await import("../src/source.mjs");
  assert.equal(fileNameFor({ type: "agent" }), "AGENT.md");
  assert.equal(fileNameFor({ type: "skill" }), "SKILL.md");
  assert.equal(fileNameFor({}), "SKILL.md");
});

test("refsFor pins to the commit SHA when present (TOCTOU defense)", async () => {
  const { refsFor } = await import("../src/source.mjs");
  assert.deepEqual(refsFor({ rev: "abc1234" }), ["abc1234"]);
  assert.deepEqual(refsFor({}), ["main", "master"]);
});

test("compile → agentvoy drops instructions under skills/", () => {
  const [file] = compile("agentvoy", { name: "pr-reviewer", type: "agent", md: "RAW-INSTRUCTIONS" }, { cwd: "/tmp/p" });
  assert.match(file.path, /\/skills\/pr-reviewer\.md$/);
  assert.equal(file.content, "RAW-INSTRUCTIONS");
});

test("isDirectRef + parseDirectRef handle owner/repo/path[@rev]", async () => {
  const { isDirectRef, parseDirectRef } = await import("../src/source.mjs");
  assert.equal(isDirectRef("code-review"), false);
  assert.equal(isDirectRef("acme/tools/skills/x"), true);
  assert.equal(isDirectRef("github:acme/tools"), true);
  const r = parseDirectRef("acme/tools/skills/api@abc1234");
  assert.equal(r.repo, "https://github.com/acme/tools");
  assert.equal(r.path, "skills/api");
  assert.equal(r.name, "api");
  assert.equal(r.rev, "abc1234");
});

test("unsupported target throws", () => {
  assert.throws(() => compile("nope", { name: "x" }, {}), /Unsupported target/);
});
