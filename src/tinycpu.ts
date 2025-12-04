/**
 * TinyCPU - A minimal execution engine for testing the Debug Adapter.
 *
 * Supports three instructions:
 * - LOAD <n>  : Set accumulator to n
 * - ADD <n>   : Add n to accumulator
 * - HALT      : Stop execution
 *
 * Implemented as simple state objects plus helper functions (no classes).
 */

export interface StepResult {
  halted: boolean;
  pc: number;
  acc: number;
}

export interface TinyCpuState {
  pc: number;
  acc: number;
  halted: boolean;
  readonly program: readonly string[];
}

export function createTinyCpu(program: string[]): TinyCpuState {
  return {
    pc: 0,
    acc: 0,
    halted: false,
    program: Object.freeze([...program]),
  };
}

/**
 * Execute one instruction and advance the program counter.
 * Mutates the provided state object.
 */
export function stepTinyCpu(state: TinyCpuState): StepResult {
  if (state.halted || state.pc >= state.program.length) {
    state.halted = true;
    return { halted: true, pc: state.pc, acc: state.acc };
  }

  const line = state.program[state.pc];
  if (line === undefined) {
    state.halted = true;
    return { halted: true, pc: state.pc, acc: state.acc };
  }

  const instruction = line.trim().toUpperCase();

  // Blank lines and comments are no-ops so source lines stay aligned.
  if (instruction === '' || instruction.startsWith(';')) {
    state.pc++;
    return finishStep(state);
  }

  if (instruction === 'HALT') {
    state.halted = true;
    return { halted: true, pc: state.pc, acc: state.acc };
  }

  if (instruction.startsWith('LOAD ')) {
    const value = parseNumber(instruction.substring(5));
    if (value !== undefined) {
      state.acc = value;
    }
  } else if (instruction.startsWith('ADD ')) {
    const value = parseNumber(instruction.substring(4));
    if (value !== undefined) {
      state.acc += value;
    }
  } else if (instruction === 'NOP') {
    // No operation
  } else if (instruction.startsWith('JMP ')) {
    const target = parseNumber(instruction.substring(4));
    if (target !== undefined && target >= 0 && target < state.program.length) {
      state.pc = target;
      return { halted: false, pc: state.pc, acc: state.acc };
    }
  }

  state.pc++;
  return finishStep(state);
}

export function resetTinyCpu(state: TinyCpuState): void {
  state.pc = 0;
  state.acc = 0;
  state.halted = false;
}

function finishStep(state: TinyCpuState): StepResult {
  if (state.pc >= state.program.length) {
    state.halted = true;
    return { halted: true, pc: state.pc, acc: state.acc };
  }

  return { halted: false, pc: state.pc, acc: state.acc };
}

function parseNumber(str: string): number | undefined {
  const trimmed = str.trim();
  const num = parseInt(trimmed, 10);
  return Number.isNaN(num) ? undefined : num;
}
