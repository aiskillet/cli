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

test("unsupported target throws", () => {
  assert.throws(() => compile("nope", { name: "x" }, {}), /Unsupported target/);
});
