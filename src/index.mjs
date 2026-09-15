import { parseArgs } from "node:util";
import { search, add, list, remove } from "./commands.mjs";
import { TARGETS } from "./compile.mjs";

export const VERSION = "0.6.0";

const HELP = `\x1b[1m🍳 skillet\x1b[0m — install AI skills into any tool. Write once, run anywhere.

\x1b[1mUsage\x1b[0m
  skillet <command> [options]

\x1b[1mCommands\x1b[0m
  search [query]              Search the AISkillet marketplace
  add <name> --target <t>     Compile a skill and install it for a target tool
  list                        List skills installed in this directory
  remove <name> [--target t]  Remove an installed skill
  targets                     List supported targets
  help                        Show this help

\x1b[1mTargets\x1b[0m
  ${TARGETS.join(", ")}

\x1b[1mOptions\x1b[0m
  -t, --target <name>   Target tool to compile for
  -g, --global          Install for the user (e.g. ~/.claude) instead of the project
      --registry <url>   Registry index.json URL or local path (env: SKILLET_REGISTRY)
      --cwd <dir>        Project directory to install into (default: current dir)
  -h, --help             Show help
  -v, --version          Show version

\x1b[1mExamples\x1b[0m
  skillet search api
  skillet add api-design --target cursor
  skillet add api-design --target claude-code --global
  skillet list
`;

export async function main(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        target: { type: "string", short: "t" },
        registry: { type: "string" },
        global: { type: "boolean", short: "g" },
        cwd: { type: "string" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });
  } catch (err) {
    console.error(`\x1b[31m✗ ${err.message}\x1b[0m\n`);
    console.log(HELP);
    process.exitCode = 1;
    return;
  }

  const { values, positionals } = parsed;
  const cmd = positionals[0];

  if (values.version) {
    console.log(VERSION);
    return;
  }
  if (!cmd || (values.help && cmd == null)) {
    console.log(HELP);
    return;
  }

  switch (cmd) {
    case "search":
      await search(positionals[1], values);
      break;
    case "add":
    case "install":
      await add(positionals[1], values);
      break;
    case "list":
    case "ls":
      await list(values);
      break;
    case "remove":
    case "rm":
      await remove(positionals[1], values);
      break;
    case "targets":
      console.log("Supported targets:\n" + TARGETS.map((t) => "  " + t).join("\n"));
      break;
    case "help":
      console.log(HELP);
      break;
    default:
      console.error(`\x1b[31m✗ Unknown command: ${cmd}\x1b[0m\n`);
      console.log(HELP);
      process.exitCode = 1;
  }
}
