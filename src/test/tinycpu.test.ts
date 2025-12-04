import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createTinyCpu,
  runTinyCpu,
  stepTinyCpu,
  validateTinyCpuProgram,
} from '../tinycpu';

describe('TinyCpu', () => {
  it('executes LOAD/ADD and halts on HALT', () => {
    const cpu = createTinyCpu(['LOAD 10', 'ADD 5', 'HALT']);

    let result = stepTinyCpu(cpu);
    assert.equal(result.halted, false);
    assert.equal(cpu.acc, 10);
    assert.equal(cpu.pc, 1);

    result = stepTinyCpu(cpu);
    assert.equal(result.halted, false);
    assert.equal(cpu.acc, 15);
    assert.equal(cpu.pc, 2);

    result = stepTinyCpu(cpu);
    assert.equal(result.halted, true);
    assert.equal(cpu.halted, true);
    assert.equal(cpu.pc, 2);
  });

  it('treats comments and blanks as no-ops that advance the pc', () => {
    const cpu = createTinyCpu(['; comment', '', 'LOAD 2', 'ADD 3']);

    let result = stepTinyCpu(cpu);
    assert.equal(result.halted, false);
    assert.equal(cpu.pc, 1);
    assert.equal(cpu.acc, 0);

    result = stepTinyCpu(cpu);
    assert.equal(result.halted, false);
    assert.equal(cpu.pc, 2);
    assert.equal(cpu.acc, 0);

    result = stepTinyCpu(cpu);
    assert.equal(result.halted, false);
    assert.equal(cpu.pc, 3);
    assert.equal(cpu.acc, 2);
  });

  it('halts when the pc runs past the end of the program', () => {
    const cpu = createTinyCpu(['LOAD 1']);

    const result = stepTinyCpu(cpu);
    assert.equal(result.halted, true);
    assert.equal(cpu.halted, true);
    assert.equal(cpu.pc, 1);
    assert.equal(cpu.acc, 1);
  });

  it('stops on breakpoint during run', () => {
    const cpu = createTinyCpu(['LOAD 1', 'ADD 2', 'ADD 3']);
    const breakpoints = new Set<number>([1]); // stop before ADD 2 executes

    const result = runTinyCpu(cpu, breakpoints);
    assert.equal(result.reason, 'breakpoint');
    assert.equal(cpu.pc, 1);
    assert.equal(cpu.acc, 1);

    const next = stepTinyCpu(cpu);
    assert.equal(next.halted, false);
    assert.equal(cpu.pc, 2);
    assert.equal(cpu.acc, 3);
  });

  it('validates invalid instructions and operands', () => {
    const errors = validateTinyCpuProgram(['LOAD foo', 'JMP -1', 'XYZ']);
    assert.equal(errors.length, 3);
    const [e1, e2, e3] = errors;
    assert.ok(e1?.includes('Line 1'));
    assert.ok(e2?.includes('Line 2'));
    assert.ok(e3?.includes('Line 3'));
  });
});
