// Tracks what's installed where, in a per-project lockfile: .skillet/installed.json

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const dir = (cwd) => join(cwd, ".skillet");
const lockPath = (cwd) => join(dir(cwd), "installed.json");

/** Short content hash — used to detect local edits before overwrite/remove. */
export function hashContent(s) {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

export async function readLock(cwd) {
  const p = lockPath(cwd);
  if (!existsSync(p)) return { installed: [] };
  try {
    const lock = JSON.parse(await readFile(p, "utf8"));
    return { installed: Array.isArray(lock.installed) ? lock.installed : [] };
  } catch {
    return { installed: [] };
  }
}

export async function writeLock(cwd, lock) {
  await mkdir(dir(cwd), { recursive: true });
  await writeFile(lockPath(cwd), JSON.stringify(lock, null, 2) + "\n");
}

/** The recorded install for a given file path, if skillet installed it. */
export async function findInstall(cwd, path) {
  const lock = await readLock(cwd);
  return lock.installed.find((r) => r.path === path);
}

/** Record (or replace) an install for a given name+target. */
export async function recordInstall(cwd, record) {
  const lock = await readLock(cwd);
  lock.installed = lock.installed.filter(
    (r) => !(r.name === record.name && r.target === record.target)
  );
  lock.installed.push(record);
  await writeLock(cwd, lock);
}

/** Remove install records matching name (and optional target). Returns them. */
export async function removeInstall(cwd, name, target) {
  const lock = await readLock(cwd);
  const match = (r) => r.name === name && (!target || r.target === target);
  const removed = lock.installed.filter(match);
  lock.installed = lock.installed.filter((r) => !match(r));
  await writeLock(cwd, lock);
  return removed;
}
