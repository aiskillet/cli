import { writeFile, mkdir, rm } from "node:fs/promises";
import { dirname, relative } from "node:path";
import { loadRegistry, searchEntries, findEntry } from "./registry.mjs";
import { fetchItem } from "./source.mjs";
import { compile, TARGETS } from "./compile.mjs";
import { recordInstall, readLock, removeInstall } from "./store.mjs";

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const ok = (s) => `\x1b[32m${s}\x1b[0m`;

function rel(cwd, p) {
  const r = relative(cwd, p);
  return r.startsWith("..") ? p : r;
}

export async function search(query, opts) {
  const entries = await loadRegistry(opts.registry);
  const results = searchEntries(entries, query);
  if (!results.length) {
    console.log(`No results${query ? ` for "${query}"` : ""}.`);
    return;
  }
  console.log(`Found ${results.length} listing${results.length === 1 ? "" : "s"}:\n`);
  for (const e of results) {
    console.log(`  ${bold(e.name)}  ${dim(`[${e.type}]`)}${e.verified ? "  " + ok("✓") : ""}`);
    console.log(`    ${e.description}`);
    console.log(`    ${dim(`skillet add ${e.name} --target <${TARGETS.join("|")}>`)}\n`);
  }
}

export async function add(name, opts) {
  if (!name) throw new Error("Usage:  skillet add <name> --target <target>");
  const target = opts.target;
  if (!target) throw new Error(`Specify a target:  --target <${TARGETS.join("|")}>`);
  const cwd = opts.cwd || process.cwd();

  const entries = await loadRegistry(opts.registry);
  const entry = findEntry(entries, name);

  process.stdout.write(`Resolving ${bold(name)}@aiskillet … `);
  const item = await fetchItem(entry);
  console.log(ok("ok"));

  const files = compile(target, item, { global: opts.global, cwd });
  for (const f of files) {
    await mkdir(dirname(f.path), { recursive: true });
    await writeFile(f.path, f.content);
    await recordInstall(cwd, {
      name: item.name,
      target,
      path: f.path,
      installedAt: new Date().toISOString(),
    });
    console.log(`  ${ok("✓")} ${rel(cwd, f.path)}`);
  }
  console.log(`\n${ok("✓")} Installed ${bold(item.name)} (${item.type}) → ${target}.`);
}

export async function list(opts) {
  const cwd = opts.cwd || process.cwd();
  const lock = await readLock(cwd);
  if (!lock.installed.length) {
    console.log("No skills installed in this directory.");
    return;
  }
  console.log(`Installed here ${dim(`(${cwd})`)}:\n`);
  for (const r of lock.installed) {
    console.log(`  ${bold(r.name)}  ${dim(`→ ${r.target}`)}  ${dim(rel(cwd, r.path))}`);
  }
}

export async function remove(name, opts) {
  if (!name) throw new Error("Usage:  skillet remove <name> [--target <target>]");
  const cwd = opts.cwd || process.cwd();
  const removed = await removeInstall(cwd, name, opts.target);
  if (!removed.length) {
    console.log(`Nothing to remove for "${name}"${opts.target ? ` (target ${opts.target})` : ""}.`);
    return;
  }
  for (const r of removed) {
    await rm(r.path, { force: true });
    console.log(`  ${ok("✓")} removed ${rel(cwd, r.path)} ${dim(`(${r.target})`)}`);
  }
}
