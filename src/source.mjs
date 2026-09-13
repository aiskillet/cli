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

function rawUrls(entry) {
  const { owner, repo } = parseRepo(entry.repo);
  const base = entry.path ? entry.path.replace(/\/+$/, "") + "/" : "";
  const file = fileNameFor(entry);
  return ["main", "master"].map(
    (branch) =>
      `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${base}${file}`
  );
}

/** Fetch + parse the canonical doc (SKILL.md or AGENT.md) for a catalog entry. */
export async function fetchItem(entry) {
  for (const url of rawUrls(entry)) {
    const res = await fetch(url);
    if (res.ok) {
      const md = await res.text();
      const { data, body } = parseFrontmatter(md);
      return {
        md,
        body,
        type: entry.type || "skill",
        name: data.name || entry.name,
        description: data.description || entry.description || "",
      };
    }
  }
  throw new Error(
    `Could not fetch ${fileNameFor(entry)} for "${entry.name}" from ${entry.repo}` +
      (entry.path ? ` (path: ${entry.path})` : "")
  );
}
