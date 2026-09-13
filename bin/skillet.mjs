#!/usr/bin/env node
import { main } from "../src/index.mjs";

main(process.argv.slice(2)).catch((err) => {
  console.error(`\x1b[31m✗ ${err?.message ?? err}\x1b[0m`);
  process.exit(1);
});
