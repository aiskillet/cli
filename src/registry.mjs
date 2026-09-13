import { readFile } from "node:fs/promises";

const DEFAULT_REGISTRY =
  process.env.SKILLET_REGISTRY || "https://aiskillet.com/index.json";

/** Load the marketplace catalog from a URL or local file path. */
export async function loadRegistry(registry) {
  const src = registry || DEFAULT_REGISTRY;
  let text;
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src);
    if (!res.ok) {
      throw new Error(`Failed to load registry (${res.status}) from ${src}`);
    }
    text = await res.text();
  } else {
    text = await readFile(src.replace(/^file:\/\//, ""), "utf8");
  }
  const data = JSON.parse(text);
  const entries = Array.isArray(data) ? data : data.entries || [];
  if (!entries.length) throw new Error(`Registry at ${src} has no entries.`);
  return entries;
}

export function searchEntries(entries, query) {
  if (!query) return entries;
  const q = query.toLowerCase();
  return entries.filter((e) =>
    [e.name, e.title, e.description, ...(e.tags || [])]
      .join(" ")
      .toLowerCase()
      .includes(q)
  );
}

export function findEntry(entries, name) {
  const e = entries.find((x) => x.name === name);
  if (!e) {
    throw new Error(`No listing named "${name}". Try:  skillet search ${name}`);
  }
  return e;
}
