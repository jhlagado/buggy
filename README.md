# TinyCPU Debugger

A minimal VS Code debug adapter prototype that exercises the Debug Adapter Protocol (DAP) end-to-end using a toy CPU. It proves breakpoints, stepping, variables, and session lifecycle before swapping in a real Z80 backend.

- **Spec:** `docs/specs/debugger-architecture.md`
- **Plan:** `docs/implementation-plan.md`

## What this is

- A thin VS Code extension that registers a custom debugger type (`tinycpu`).
- An inline debug adapter that translates DAP requests to a TinyCPU runtime.
- A TinyCPU runtime implemented as simple state + functions (no classes) to keep logic easy to inspect and test.

**Purpose:** validate the debugger pipeline (launch → breakpoints → run/step → variables → halt) in isolation from a real emulator. Once stable, the TinyCPU can be swapped for a Z80 engine without changing the DAP layer.

## Current capabilities

- Launch and debug `.tiny` files with breakpoints and step/continue.
- Single thread, single frame; variables show `pc` and `acc`.
- Blank lines and `;` comments are treated as no-ops to keep line numbers aligned.
- HALT stops with reason `halt`; continue again to terminate.
- Unit tests for TinyCPU and breakpoint handling (`yarn test`).

Known limitations:
- `pause` is a no-op for this synchronous runtime.
- Error messages are minimal; malformed programs aren’t deeply validated.
- Engine warnings about `engines.vscode` are expected (package managers don’t know that field).

## TinyCPU model (debug target)

- State: `pc`, `acc`, `program`.
- Instructions: `LOAD n`, `ADD n`, `HALT`, optional `NOP`, `JMP n`.
- Execution: each `step` mutates state; `run` executes until breakpoint or halt.
- Comments/blank lines: no-ops; keep source line mapping stable.

## Architecture snapshot

- **VS Code UI**: built-in debugger UI.
- **Debug Adapter**: `src/adapter.ts` extends `DebugSession`, handles DAP requests, manages breakpoints, emits stopped/terminated events.
- **Runtime**: `src/tinycpu.ts` functional CPU helpers (`createTinyCpu`, `stepTinyCpu`, `runTinyCpu`).
- **Transport**: inline adapter (no separate process) via `DebugAdapterDescriptorFactory` in `src/extension.ts`.

## Repo layout

```
src/
  adapter.ts       # DAP session
  extension.ts     # Extension entry, inline adapter factory
  tinycpu.ts       # TinyCPU runtime (functional)
  test/tinycpu.test.ts
examples/
  simple.tiny
docs/
  specs/debugger-architecture.md
  implementation-plan.md
```

## Getting started

Prereqs: Node 18+ (Node 20+ recommended) and VS Code.

```bash
yarn install --ignore-engines
yarn build
yarn test          # node --test over compiled output
```

## Running the example

1) Press F5 in VS Code with the “Extension” config to open the Extension Development Host.  
2) In the Dev Host, open `examples/simple.tiny`.  
3) In Run and Debug, pick “Debug TinyCPU Program”, then Start.  
4) With `stopOnEntry` true, you stop at the first instruction; Step/Continue and watch `pc`/`acc` in Variables. Breakpoints on instruction lines are honored.

Tips:
- HALT sends a stopped event (`halt`); hit Continue again to terminate.
- Leading comments/blank lines are no-ops but still count toward line numbers.
- Set `stopOnEntry` false if you want to auto-run after configuration is done.

## Packaging (optional)

```bash
yarn build
yarn package   # uses vsce; Node 20+ recommended
```

## Roadmap highlights

- Improve error messaging/validation for malformed programs.
- Optional: implement real pause/interrupt semantics.
- Swap TinyCPU for a Z80 runtime without changing the DAP layer.
- Add README quickstart for Z80 once the engine lands.
