import { writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { loadRegistry, searchEntries, findEntry } from "./registry.mjs";
import { fetchItem, fetchPluginManifest, isDirectRef, parseDirectRef } from "./source.mjs";
import { compile, TARGETS } from "./compile.mjs";
import { recordInstall, readLock, writeLock, findInstall, hashContent } from "./store.mjs";

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const ok = (s) => `\x1b[32m${s}\x1b[0m`;
const warn = (s) => `\x1b[33m${s}\x1b[0m`;

function rel(cwd, p) {
  const r = relative(cwd, p);
  return r.startsWith("..") ? p : r;
}

/**
 * Write a compiled file, protecting local edits. If the target exists and was
 * changed since skillet installed it (or isn't managed by skillet), skip it
 * unless `force`. Records a content hash so future add/remove can detect edits.
 * Returns true if written.
 */
async function installFile(cwd, f, { name, target, force, source }) {
  const newHash = hashContent(f.content);
  if (existsSync(f.path) && !force) {
    const current = hashContent(readFileSync(f.path, "utf8"));
    if (current !== newHash) {
      const prior = await findInstall(cwd, f.path);
      const reason = prior && prior.hash ? "locally modified" : "exists, not managed by skillet";
      console.log(`  ${warn("•")} skipped ${rel(cwd, f.path)} ${dim(`— ${reason} (use --force)`)}`);
      return false;
    }
  }
  await mkdir(dirname(f.path), { recursive: true });
  await writeFile(f.path, f.content);
  await recordInstall(cwd, { name, target, path: f.path, hash: newHash, source, installedAt: new Date().toISOString() });
  return true;
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

  // Bring-your-own-repo: install straight from any repo, no catalog entry needed.
  if (isDirectRef(name)) {
    const ref = parseDirectRef(name);
    const where = `${ref.repo.replace("https://github.com/", "")}${ref.path ? "/" + ref.path : ""}${ref.rev ? "@" + ref.rev.slice(0, 7) : ""}`;
    process.stdout.write(`Resolving ${bold(where)} … `);
    const item = await fetchItem(ref);
    console.log(ok("ok"));
    for (const f of compile(target, item, { global: opts.global, cwd })) {
      if (await installFile(cwd, f, { name: item.name, target, force: opts.force, source: ref.repo })) {
        console.log(`  ${ok("✓")} ${rel(cwd, f.path)}`);
      }
    }
    console.log(`\n${ok("✓")} Installed ${bold(item.name)} ${dim(`(${item.type}, direct)`)} → ${target}.`);
    return;
  }

  const entries = await loadRegistry(opts.registry);
  const entry = findEntry(entries, name);

  // MCP servers run as external processes — not compiled by skillet. Show the command.
  if (entry.type === "mcp") {
    console.log(`${bold(name)} is an MCP server. Add it to Claude Code with:\n`);
    console.log(`  ${entry.install}\n`);
    console.log(dim(`Source: ${entry.repo}`));
    return;
  }

  // Plugin = a bundle: install each member entry.
  if (entry.type === "plugin") {
    const manifest = await fetchPluginManifest(entry);
    console.log(`Installing plugin ${bold(name)} — ${manifest.includes.length} item(s) → ${target}\n`);
    let count = 0;
    for (const inc of manifest.includes) {
      const member = findEntry(entries, inc.name);
      const item = await fetchItem(member);
      for (const f of compile(target, item, { global: opts.global, cwd })) {
        if (await installFile(cwd, f, { name: item.name, target, force: opts.force })) {
          console.log(`  ${ok("✓")} ${item.name} ${dim(`(${item.type})`)} → ${rel(cwd, f.path)}`);
        }
      }
      count++;
    }
    console.log(`\n${ok("✓")} Installed plugin ${bold(name)} (${count} items) → ${target}.`);
    return;
  }

  process.stdout.write(`Resolving ${bold(name)}@aiskillet … `);
  const item = await fetchItem(entry);
  console.log(ok("ok"));

  for (const f of compile(target, item, { global: opts.global, cwd })) {
    if (await installFile(cwd, f, { name: item.name, target, force: opts.force })) {
      console.log(`  ${ok("✓")} ${rel(cwd, f.path)}`);
    }
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
  const lock = await readLock(cwd);
  const match = (r) => r.name === name && (!opts.target || r.target === opts.target);
  const matches = lock.installed.filter(match);
  if (!matches.length) {
    console.log(`Nothing to remove for "${name}"${opts.target ? ` (target ${opts.target})` : ""}.`);
    return;
  }
  const kept = [];
  for (const r of matches) {
    // Don't delete a file the user edited after install — unless --force.
    if (!opts.force && existsSync(r.path) && r.hash && hashContent(readFileSync(r.path, "utf8")) !== r.hash) {
      console.log(`  ${warn("•")} kept ${rel(cwd, r.path)} ${dim("— locally modified (use --force to delete)")}`);
      kept.push(r);
      continue;
    }
    await rm(r.path, { force: true });
    console.log(`  ${ok("✓")} removed ${rel(cwd, r.path)} ${dim(`(${r.target})`)}`);
  }
  lock.installed = lock.installed.filter((r) => !match(r) || kept.includes(r));
  await writeLock(cwd, lock);
}
