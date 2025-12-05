# Adapter Overview

This document explains how `src/adapter.ts` drives a TinyCPU debugging session.

## Structure and State

- Extends `DebugSession` from `@vscode/debugadapter`; overrides DAP request handlers.
- State fields:
  - `cpu: TinyCpuState | undefined`
  - `sourceFile: string`
  - `stopOnEntry: boolean`
  - `haltNotified: boolean` (avoid duplicate events on HALT)
  - `variableHandles` (single "registers" scope)
  - `breakpoints: Set<number>` (0-based PCs)

## Session Setup

- `initializeRequest` declares capabilities (`supportsConfigurationDoneRequest`, `supportsSingleThreadExecutionRequests`) and emits `InitializedEvent`.
- `launchRequest`:
  - Reads program file, splits into lines.
  - Validates via `validateTinyCpuProgram`; on errors, sends `sendErrorResponse`.
  - Creates CPU with `createTinyCpu(lines)`, saves `stopOnEntry`, responds.
  - If `stopOnEntry` is true, emits `StoppedEvent('entry')`.
- `configurationDoneRequest`: responds; if not stopping on entry, starts execution (`runUntilStop`) after breakpoints are set.

## Breakpoints

- `setBreakPointsRequest`:
  - Clears old breakpoints.
  - Validates lines against `cpu.program.length`.
  - Stores 0-based PCs; returns verified/unverified breakpoints with 1-based lines.

## Execution Control

- `continueRequest`: responds, then `runUntilStop()`.
- `next/stepIn/stepOut`:
  - Single-step via `stepTinyCpu`.
  - On halt → `handleHaltStop`; otherwise reset `haltNotified` and emit `StoppedEvent('step')`.
- `pauseRequest`: no-op for synchronous TinyCPU (no in-flight execution to interrupt).
- `runUntilStop`:
  - Uses `runTinyCpu(cpu, breakpoints)` to loop until breakpoint or halt.
  - On breakpoint → emit `StoppedEvent('breakpoint')`.
  - On halt → `handleHaltStop`.
- `handleHaltStop`:
  - First call on halt emits `StoppedEvent('halt')` and marks `haltNotified`.
  - If called again (e.g., user continues after halt), emits `TerminatedEvent`.

## Inspection

- `threadsRequest`: returns one thread (ID 1).
- `stackTraceRequest`: returns one frame with `line = cpu.pc + 1` and the loaded source file.
- `scopesRequest`: returns a single "Registers" scope.
- `variablesRequest`: for the registers scope, returns `pc` and `acc` values; otherwise empty.

## Disconnect

- `disconnectRequest`: clears `cpu`/`haltNotified`, responds.

## Key Behaviors

- UI line numbers are 1-based; internal PC and breakpoints are 0-based.
- Blank lines and `;` comments are NOPs in TinyCPU, so line mapping stays consistent.
- Validation occurs before launch; invalid instructions/operands produce an error response.

## Flow Summary

1. VS Code sends `initialize` → adapter replies and emits `InitializedEvent`.
2. VS Code sets breakpoints → adapter stores them 0-based.
3. VS Code sends `launch` → adapter loads/validates program, builds CPU, responds; if `stopOnEntry` is true, emits `StoppedEvent('entry')`.
4. After `configurationDone`, adapter auto-runs if not stopping on entry.
5. `continue` uses `runTinyCpu` to stop on breakpoint or halt; `next` steps one instruction.
6. State inspection via `stackTrace`/`scopes`/`variables`; `acc`/`pc` reflect executed state.

## Pause Semantics

`pause` assumes the target can be interrupted mid-run. TinyCPU executes synchronously in a tight loop, so there is no running async task to signal; the adapter receives `pause` only when idle, making it effectively a no-op. Supporting real pause would require an async/interruptible execution model or a separate worker/process you can signal. 
