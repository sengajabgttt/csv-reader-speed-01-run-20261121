// The driver for this entry: it reads every case from /input/cases.json,
// answers each one with solve.js, and writes /output/answers.json. It runs
// on Node 22, which reads TypeScript as it is. No dependencies.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';

// Turn V8's incremental marking off before solve.js is imported, so all of
// the parsing runs under it: the reference driver does the same, and it
// keeps the many short strings the parser builds from being marked a step
// at a time.
setFlagsFromString('--no-incremental-marking');

/** solve.js, imported by its URL, typed by the contract it keeps. */
const solve = (await import(new URL('./solve.js', import.meta.url).href)) as {
  run: (input: unknown) => unknown;
};

const inputDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const cases = JSON.parse(readFileSync(join(inputDir, 'cases.json'), 'utf8')) as Array<{
  id: string;
  input: unknown;
}>;

const answers = cases.map((c) => solve.run(c.input));

writeFileSync(join(outputDir, 'answers.json'), JSON.stringify(answers));
