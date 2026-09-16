// Fetches a skill's canonical SKILL.md from its source repo and parses it.
// We never execute anything — we only read the Markdown + frontmatter.

/** Parse a repo URL like https://github.com/owner/repo into parts. */
export function parseRepo(repoUrl) {
  const u = new URL(repoUrl);
  const [owner, repo] = u.pathname
    .replace(/^\//, "")
    .replace(/\.git$/, "")
    .split("/");
  if (!owner || !repo) throw new Error(`Not a GitHub repo URL: ${repoUrl}`);
  return { owner, repo };
}

/** Minimal YAML-frontmatter parser (flat key: value pairs). */
export function parseFrontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: md.trim() };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key) data[key] = val;
  }
  return { data, body: m[2].trim() };
}

/** The canonical file name for an entry's type. */
export function fileNameFor(entry) {
  return entry.type === "agent" ? "AGENT.md" : "SKILL.md";
}

/**
 * Which git ref(s) to fetch. If the entry pins a commit SHA (`rev`), we fetch
 * exactly that commit — defeating TOCTOU (source can't change under us).
 * Otherwise fall back to the default branch.
 */
export function refsFor(entry) {
  return entry.rev ? [entry.rev] : ["main", "master"];
}

/** Is this a direct repo reference (bring-your-own-repo) rather than a catalog name? */
export function isDirectRef(ref) {
  return /\//.test(ref) || ref.startsWith("github:") || /^https?:\/\//.test(ref);
}

/**
 * Parse a "bring your own repo" reference into a synthetic entry:
 *   owner/repo · owner/repo/sub/path · owner/repo/path@<sha> · github:owner/repo/path
 *   https://github.com/owner/repo(/tree/<ref>/<path>)
 */
export function parseDirectRef(ref) {
  let s = ref.trim().replace(/^github:/, "");
  const urlm = s.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/(?:tree|blob)\/([^/]+)\/(.+?))?\/?$/
  );
  if (urlm) {
    const [, owner, repo, branch, path] = urlm;
    const rev = branch && /^[0-9a-f]{7,40}$/i.test(branch) ? branch : undefined;
    return {
      name: path ? path.split("/").pop() : repo,
      repo: `https://github.com/${owner}/${repo}`,
      path: path || undefined,
      rev,
    };
  }
  let rev;
  const am = s.match(/@([0-9a-fA-F]{7,40})$/);
  if (am) { rev = am[1]; s = s.slice(0, am.index); }
  const parts = s.replace(/\.git$/, "").split("/").filter(Boolean);
  const [owner, repo, ...rest] = parts;
  if (!owner || !repo) {
    throw new Error(`Invalid repo reference: "${ref}". Use owner/repo[/path][@sha].`);
  }
  return {
    name: rest.length ? rest[rest.length - 1] : repo,
    repo: `https://github.com/${owner}/${repo}`,
    path: rest.length ? rest.join("/") : undefined,
    rev,
  };
}

/** Fetch a plugin bundle's manifest (plugin.json) listing its member entries. */
export async function fetchPluginManifest(entry) {
  const { owner, repo } = parseRepo(entry.repo);
  const base = entry.path ? entry.path.replace(/\/+$/, "") + "/" : "";
  for (const ref of refsFor(entry)) {
    const res = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${base}plugin.json`
    );
    if (res.ok) {
      const manifest = JSON.parse(await res.text());
      manifest.includes = Array.isArray(manifest.includes) ? manifest.includes : [];
      return manifest;
    }
  }
  throw new Error(`Could not fetch plugin.json for "${entry.name}" from ${entry.repo}`);
}

/**
 * Fetch + parse the canonical doc for an entry. Catalog entries have a known
 * type (one filename); direct refs have unknown type, so we try SKILL.md then
 * AGENT.md. Honors a pinned `rev`.
 */
export async function fetchItem(entry) {
  const { owner, repo } = parseRepo(entry.repo);
  const base = entry.path ? entry.path.replace(/\/+$/, "") + "/" : "";
  const candidates =
    entry.type === "agent" ? [["AGENT.md", "agent"]]
    : entry.type === "skill" ? [["SKILL.md", "skill"]]
    : [["SKILL.md", "skill"], ["AGENT.md", "agent"]];

  for (const ref of refsFor(entry)) {
    for (const [file, type] of candidates) {
      const res = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${base}${file}`
      );
      if (res.ok) {
        const md = await res.text();
        const { data, body } = parseFrontmatter(md);
        return {
          md,
          body,
          type,
          name: data.name || entry.name,
          description: data.description || entry.description || "",
        };
      }
    }
  }
  throw new Error(
    `Could not fetch a SKILL.md or AGENT.md for "${entry.name}" from ${entry.repo}` +
      (entry.path ? ` (path: ${entry.path})` : "")
  );
}
