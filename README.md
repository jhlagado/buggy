# Z80 Debugger (asm80 + HEX/LST)

Minimal VS Code debug adapter for Z80 programs assembled with asm80. It loads Intel HEX + .lst listings, supports address breakpoints via the listing, stepping/continue, and exposes registers. TinyCPU support has been removed.

## Prerequisites

- Node 18+ (Node 20+ recommended)
- Yarn
- asm80 installed locally: `yarn add -D asm80`

## Install & Build

```bash
yarn install --ignore-engines
yarn build
yarn test
```

## Z80 workflow

1) Open your root `.asm` file (assembled by asm80).
2) Use the “Debug Z80 (asm80)” launch config. It runs the `asm80: build z80` task to emit `build/<name>.hex` and `build/<name>.lst`, then loads them.
3) Set breakpoints in the generated `.lst`; they map to instruction addresses.
4) Start debugging (F5). `stopOnEntry` halts on entry; Step/Continue as usual. Registers show in the Variables view.

Task/launch config reference:
- `.vscode/tasks.json` includes `asm80: build z80` (assembles active .asm into `build/`).
- `.vscode/launch.json` has a “Debug Z80 (asm80)” config pointing at the active asm and output dir.

Notes:
- HALT stops execution; Continue again to terminate.
- Listing/HEX are required; ensure the preLaunch task has run.
