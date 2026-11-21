# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/sengajabgttt/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/sengajabgttt/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for csv-reader 1.0.0: it reads broken CSV files and answers exactly as the reference does — same columns, rows and errors, byte for byte — but faster. `solve.js` is a dependency-free ES module; `main.ts` is the driver the harness runs, reading every case from `/input/cases.json` and writing `/output/answers.json`.

## How it works

The reference walks the text one character at a time and grows every field a character at a time. This reader instead jumps from one delimiter to the next and cuts each field out whole, so a plain field costs one search and one slice. A record whose line holds no quote at all is split in one go. Only the rare broken bits take a slower path: a stray CR outside quotes, junk after a closing quote, a quote that never closes, and short or long rows — all handled with the reference's exact error records (`{code, line, row}`, plus `fields` on short rows and `extra` on long rows). The cases the generator draws hold about one broken record in forty, so the slow paths barely matter.

It is pure: no clock, no randomness, nothing kept from one call to the next, so the same input always gives the same answer.

## Run it

```sh
MAKEFUN_INPUT_DIR=./practice/input MAKEFUN_OUTPUT_DIR=./out node main.ts
```

## Verification

Checked against the practice set in the kit: all 6 cases byte-identical to the reference (the kit scorer reports passed 1, 6/6). Also fuzzed against csv-reader 1.0.0 on 20,292 generated broken CSVs (random soups, structured cases and hand-picked edges) — identical on every one. Timed on the practice set (~10.6 MB of CSV, one CPU, three runs): the parser takes ~370 ms against the reference's ~980 ms (about 2.7× faster); the whole program takes ~740 ms against ~1,330 ms (about 1.8× faster, the rest being input reading and answer writing both sides pay).

---

<sub>Entered on [make.fun](https://make.fun/?ref=1c6jcmp6&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
