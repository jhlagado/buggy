# TinyCPU Debugger Implementation Plan

This document tracks the implementation of the TinyCPU debugging prototype for VS Code.

> **Reference**: [Architecture Spec](specs/debugger-architecture.md)

---

## Phase 1: Project Scaffolding

- [ ] Initialize npm project with TypeScript
- [ ] Create `package.json` with VS Code extension manifest
- [ ] Configure `tsconfig.json` for extension development
- [ ] Create `.vscode/launch.json` for Extension Development Host
- [ ] Verify extension loads in VS Code (empty activate function)

---

## Phase 2: TinyCPU Runtime

- [ ] Create `src/tinycpu.ts`
- [ ] Implement state: `pc`, `acc`, `program[]`
- [ ] Implement instruction parser (LOAD, ADD, HALT)
- [ ] Implement `step()` — execute one instruction
- [ ] Implement `run(breakpoints)` — execute until halt/breakpoint
- [ ] Implement `reset()` — restore initial state
- [ ] Write unit tests for TinyCPU

---

## Phase 3: Debug Adapter (Core)

- [ ] Create `src/adapter.ts` extending `DebugSession`
- [ ] Implement `initializeRequest` — declare capabilities
- [ ] Implement `launchRequest` — load program, create TinyCPU instance
- [ ] Implement `setBreakpointsRequest` — store breakpoints, return verified
- [ ] Implement `configurationDoneRequest` — signal ready
- [ ] Implement `disconnectRequest` — clean shutdown

---

## Phase 4: Debug Adapter (Execution)

- [ ] Implement `continueRequest` — run until breakpoint/halt
- [ ] Implement `nextRequest` — step one instruction
- [ ] Implement `pauseRequest` — interrupt execution
- [ ] Send correct `StoppedEvent` with reason (`step`, `breakpoint`, `halt`)

---

## Phase 5: Debug Adapter (Inspection)

- [ ] Implement `threadsRequest` — return single thread
- [ ] Implement `stackTraceRequest` — return single frame with current line
- [ ] Implement `scopesRequest` — return "Registers" scope
- [ ] Implement `variablesRequest` — return `pc` and `acc` values

---

## Phase 6: Extension Entry Point

- [ ] Create `src/extension.ts`
- [ ] Register `DebugAdapterDescriptorFactory`
- [ ] Configure inline adapter (no separate process)

---

## Phase 7: Integration Testing

- [ ] Create sample `.tiny` program files
- [ ] Test: launch and hit HALT
- [ ] Test: set breakpoint, continue, verify stop
- [ ] Test: step through program line by line
- [ ] Test: inspect registers at each step
- [ ] Test: out-of-bounds execution handling

---

## Phase 8: Polish

- [ ] Add `stopOnEntry` launch option
- [ ] Improve error messages for malformed programs
- [ ] Document usage in README
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
├── test/
│   └── tinycpu.test.ts
└── docs/
    ├── specs/
    │   └── debugger-architecture.md
    └── implementation-plan.md
```
