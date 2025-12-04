# TinyCPU Debugger Implementation Plan

This document tracks the implementation of the TinyCPU debugging prototype for VS Code.

> **Reference**: [Architecture Spec](specs/debugger-architecture.md)

---

## Phase 1: Project Scaffolding

- [x] Initialize npm project with TypeScript
- [x] Create `package.json` with VS Code extension manifest
- [x] Configure `tsconfig.json` for extension development
- [x] Create `.vscode/launch.json` for Extension Development Host
- [x] Verify extension loads in VS Code (empty activate function)

---

## Phase 2: TinyCPU Runtime

- [x] Create `src/tinycpu.ts`
- [x] Implement state: `pc`, `acc`, `program[]`
- [x] Implement instruction parser (LOAD, ADD, HALT)
- [x] Implement `step()` — execute one instruction
- [x] Implement `run(breakpoints)` — execute until halt/breakpoint
- [x] Implement `reset()` — restore initial state
- [x] Write unit tests for TinyCPU

---

## Phase 3: Debug Adapter (Core)

- [x] Create `src/adapter.ts` extending `DebugSession`
- [x] Implement `initializeRequest` — declare capabilities
- [x] Implement `launchRequest` — load program, create TinyCPU instance
- [x] Implement `setBreakpointsRequest` — store breakpoints, return verified
- [x] Implement `configurationDoneRequest` — signal ready
- [x] Implement `disconnectRequest` — clean shutdown

---

## Phase 4: Debug Adapter (Execution)

- [x] Implement `continueRequest` — run until breakpoint/halt
- [x] Implement `nextRequest` — step one instruction
- [ ] Implement `pauseRequest` — interrupt execution (no-op for sync TinyCPU)
- [x] Send correct `StoppedEvent` with reason (`step`, `breakpoint`, `halt`)

---

## Phase 5: Debug Adapter (Inspection)

- [x] Implement `threadsRequest` — return single thread
- [x] Implement `stackTraceRequest` — return single frame with current line
- [x] Implement `scopesRequest` — return "Registers" scope
- [x] Implement `variablesRequest` — return `pc` and `acc` values

---

## Phase 6: Extension Entry Point

- [x] Create `src/extension.ts`
- [x] Register `DebugAdapterDescriptorFactory`
- [x] Configure inline adapter (no separate process)

---

## Phase 7: Integration Testing

- [x] Create sample `.tiny` program files
- [x] Test: launch and hit HALT
- [x] Test: set breakpoint, continue, verify stop
- [x] Test: step through program line by line
- [x] Test: inspect registers at each step
- [x] Test: out-of-bounds execution handling

---

## Phase 8: Polish

- [x] Add `stopOnEntry` launch option
- [ ] Improve error messages for malformed programs
- [x] Document usage in README
- [ ] Package with `vsce package`

---

## Acceptance Criteria

The TinyCPU debugger is **complete** when:

1. User can open a `.tiny` file and press F5 to debug
2. Breakpoints can be set and are hit correctly
3. Step/Continue/Pause all work as expected
4. Variables panel shows `pc` and `acc` values
5. Program terminates cleanly on HALT

---

## File Structure (Target)

```
buggy/
├── package.json
├── tsconfig.json
├── src/
│   ├── extension.ts      # Entry point
│   ├── adapter.ts        # Debug Adapter
│   └── tinycpu.ts        # Execution engine
├── out/                   # Compiled JS
├── src/test/
│   └── tinycpu.test.ts
└── docs/
    ├── specs/
    │   └── debugger-architecture.md
    └── implementation-plan.md
```
