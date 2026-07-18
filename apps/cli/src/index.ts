#!/usr/bin/env -S node --experimental-strip-types
import { main } from "./main.ts";

try {
  await main(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`rodge: ${message}\n`);
  process.exitCode = 1;
}
