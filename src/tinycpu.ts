/**
 * TinyCPU - A minimal execution engine for testing the Debug Adapter.
 *
 * Supports three instructions:
 * - LOAD <n>  : Set accumulator to n
 * - ADD <n>   : Add n to accumulator
 * - HALT      : Stop execution
 */

export interface StepResult {
  halted: boolean;
  pc: number;
  acc: number;
}

export class TinyCpu {
  private _pc = 0;
  private _acc = 0;
  private _halted = false;
  private readonly _program: readonly string[];

  constructor(program: string[]) {
    this._program = Object.freeze([...program]);
  }

  get pc(): number {
    return this._pc;
  }

  get acc(): number {
    return this._acc;
  }

  get halted(): boolean {
    return this._halted;
  }

  get programLength(): number {
    return this._program.length;
  }

  /**
   * Execute one instruction and advance the program counter.
   */
  step(): StepResult {
    if (this._halted || this._pc >= this._program.length) {
      this._halted = true;
      return { halted: true, pc: this._pc, acc: this._acc };
    }

    const line = this._program[this._pc];
    if (line === undefined) {
      this._halted = true;
      return { halted: true, pc: this._pc, acc: this._acc };
    }

    const instruction = line.trim().toUpperCase();

    if (instruction === 'HALT' || instruction === '') {
      this._halted = true;
      return { halted: true, pc: this._pc, acc: this._acc };
    }

    if (instruction.startsWith('LOAD ')) {
      const value = this.parseNumber(instruction.substring(5));
      if (value !== undefined) {
        this._acc = value;
      }
    } else if (instruction.startsWith('ADD ')) {
      const value = this.parseNumber(instruction.substring(4));
      if (value !== undefined) {
        this._acc += value;
      }
    } else if (instruction === 'NOP') {
      // No operation
    } else if (instruction.startsWith('JMP ')) {
      const target = this.parseNumber(instruction.substring(4));
      if (target !== undefined && target >= 0 && target < this._program.length) {
        this._pc = target;
        return { halted: false, pc: this._pc, acc: this._acc };
      }
    }

    this._pc++;

    if (this._pc >= this._program.length) {
      this._halted = true;
      return { halted: true, pc: this._pc, acc: this._acc };
    }

    return { halted: false, pc: this._pc, acc: this._acc };
  }

  /**
   * Reset CPU to initial state.
   */
  reset(): void {
    this._pc = 0;
    this._acc = 0;
    this._halted = false;
  }

  private parseNumber(str: string): number | undefined {
    const trimmed = str.trim();
    const num = parseInt(trimmed, 10);
    return isNaN(num) ? undefined : num;
  }
}
