# TinyCPU Debugger

A minimal VS Code debug adapter for a toy TinyCPU runtime. It validates the DAP pipeline (launch, breakpoints, stepping, variables) before swapping in a real Z80 backend.

## Prerequisites

- Node 18+ (Node 20+ recommended to silence `engine` warnings from `vsce` tooling)
- VS Code

## Install & Build

```bash
npm install
npm run build
```

Run tests (Node built-in runner):

```bash
npm test
```

## Debugging the TinyCPU example

1. Press F5 in VS Code using the “Extension” launch config (opens an Extension Development Host).
2. In the Dev Host, open `examples/simple.tiny`.
3. Choose the “Debug TinyCPU Program” configuration from Run and Debug.
4. Start debugging. With `stopOnEntry` enabled, you’ll stop at the first line—step/continue and observe `pc`/`acc` in the Variables view. Breakpoints on instruction lines are honored.

Notes:
- Blank lines and `;` comment lines are treated as no-ops to keep line numbers aligned.
- HALT raises a stopped event with reason `halt`; continue again to terminate the session.
  
## Packaging

When ready to package for distribution:

```bash
npm run build
npm run package   # requires vsce; Node 20+ recommended
```
