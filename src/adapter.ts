import * as vscode from 'vscode';
import {
  DebugSession,
  InitializedEvent,
  StoppedEvent,
  TerminatedEvent,
  Thread,
  StackFrame,
  Scope,
  Source,
  Handles,
} from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import { TinyCpuState, createTinyCpu, runTinyCpu, stepTinyCpu } from './tinycpu';
import * as fs from 'fs';
import * as path from 'path';

interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
  program: string;
  stopOnEntry?: boolean;
}

const THREAD_ID = 1;

export class TinyCpuDebugSession extends DebugSession {
  private cpu: TinyCpuState | undefined;
  private sourceFile = '';
  private stopOnEntry = false;
  private haltNotified = false;
  private variableHandles = new Handles<'registers'>();
  private breakpoints: Set<number> = new Set();

  public constructor() {
    super();
    this.setDebuggerLinesStartAt1(true);
    this.setDebuggerColumnsStartAt1(true);
  }

  protected initializeRequest(
    response: DebugProtocol.InitializeResponse,
    _args: DebugProtocol.InitializeRequestArguments
  ): void {
    response.body = response.body ?? {};
    response.body.supportsConfigurationDoneRequest = true;
    response.body.supportsSingleThreadExecutionRequests = true;

    this.sendResponse(response);
    this.sendEvent(new InitializedEvent());
  }

  protected launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: LaunchRequestArguments
  ): void {
    this.sourceFile = args.program;
    this.stopOnEntry = args.stopOnEntry !== false;
    this.haltNotified = false;

    try {
      const content = fs.readFileSync(this.sourceFile, 'utf-8');
      const lines = content.split(/\r?\n/);
      this.cpu = createTinyCpu(lines);

      this.sendResponse(response);

      if (this.stopOnEntry) {
        this.sendEvent(new StoppedEvent('entry', THREAD_ID));
      }
    } catch (err) {
      this.sendErrorResponse(response, 1, `Failed to load program: ${String(err)}`);
    }
  }

  protected setBreakPointsRequest(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments
  ): void {
    this.breakpoints.clear();
    const verified: DebugProtocol.Breakpoint[] = [];

    if (args.breakpoints !== undefined && this.cpu !== undefined) {
      for (const bp of args.breakpoints) {
        const line = bp.line;
        const valid = line >= 1 && line <= this.cpu.program.length;
        if (valid) {
          this.breakpoints.add(line - 1); // Convert to 0-based
        }
        verified.push({
          verified: valid,
          line: bp.line,
        });
      }
    }

    response.body = { breakpoints: verified };
    this.sendResponse(response);
  }

  protected configurationDoneRequest(
    response: DebugProtocol.ConfigurationDoneResponse,
    _args: DebugProtocol.ConfigurationDoneArguments
  ): void {
    this.sendResponse(response);

    if (!this.stopOnEntry) {
      this.runUntilStop();
    }
  }

  protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    response.body = {
      threads: [new Thread(THREAD_ID, 'Main Thread')],
    };
    this.sendResponse(response);
  }

  protected continueRequest(
    response: DebugProtocol.ContinueResponse,
    _args: DebugProtocol.ContinueArguments
  ): void {
    this.continueExecution(response);
  }

  protected nextRequest(
    response: DebugProtocol.NextResponse,
    _args: DebugProtocol.NextArguments
  ): void {
    if (this.cpu === undefined) {
      this.sendErrorResponse(response, 1, 'No program loaded');
      return;
    }

    const result = stepTinyCpu(this.cpu);
    this.sendResponse(response);

    if (result.halted) {
      this.handleHaltStop();
    } else {
      this.haltNotified = false;
      this.sendEvent(new StoppedEvent('step', THREAD_ID));
    }
  }

  protected stepInRequest(
    response: DebugProtocol.StepInResponse,
    args: DebugProtocol.StepInArguments
  ): void {
    this.nextRequest(response, args);
  }

  protected stepOutRequest(
    response: DebugProtocol.StepOutResponse,
    args: DebugProtocol.StepOutArguments
  ): void {
    this.nextRequest(response, args);
  }

  protected pauseRequest(
    response: DebugProtocol.PauseResponse,
    _args: DebugProtocol.PauseArguments
  ): void {
    // TinyCPU runs synchronously, so pause is effectively a no-op
    // The UI will show as paused after any stopped event
    this.sendResponse(response);
  }

  protected stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
    _args: DebugProtocol.StackTraceArguments
  ): void {
    if (this.cpu === undefined) {
      response.body = { stackFrames: [], totalFrames: 0 };
      this.sendResponse(response);
      return;
    }

    const line = this.cpu.pc + 1; // Convert to 1-based
    const source = new Source(path.basename(this.sourceFile), this.sourceFile);

    response.body = {
      stackFrames: [new StackFrame(0, 'main', source, line)],
      totalFrames: 1,
    };
    this.sendResponse(response);
  }

  protected scopesRequest(
    response: DebugProtocol.ScopesResponse,
    _args: DebugProtocol.ScopesArguments
  ): void {
    const registersRef = this.variableHandles.create('registers');
    response.body = {
      scopes: [new Scope('Registers', registersRef, false)],
    };
    this.sendResponse(response);
  }

  protected variablesRequest(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments
  ): void {
    const scopeType = this.variableHandles.get(args.variablesReference);

    if (scopeType === 'registers' && this.cpu !== undefined) {
      response.body = {
        variables: [
          { name: 'pc', value: String(this.cpu.pc), variablesReference: 0 },
          { name: 'acc', value: String(this.cpu.acc), variablesReference: 0 },
        ],
      };
    } else {
      response.body = { variables: [] };
    }

    this.sendResponse(response);
  }

  protected disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
    _args: DebugProtocol.DisconnectArguments
  ): void {
    this.cpu = undefined;
    this.haltNotified = false;
    this.sendResponse(response);
  }

  private continueExecution(response: DebugProtocol.Response): void {
    if (this.cpu === undefined) {
      this.sendErrorResponse(response, 1, 'No program loaded');
      return;
    }

    this.sendResponse(response);
    this.runUntilStop();
  }

  private runUntilStop(): void {
    if (this.cpu === undefined) {
      return;
    }

    const result = runTinyCpu(this.cpu, this.breakpoints);

    if (result.reason === 'breakpoint') {
      this.haltNotified = false;
      this.sendEvent(new StoppedEvent('breakpoint', THREAD_ID));
      return;
    }

    this.handleHaltStop();
  }

  private handleHaltStop(): void {
    if (!this.haltNotified) {
      this.haltNotified = true;
      this.sendEvent(new StoppedEvent('halt', THREAD_ID));
      return;
    }

    this.sendEvent(new TerminatedEvent());
  }
}

export class TinyCpuDebugAdapterFactory
  implements vscode.DebugAdapterDescriptorFactory
{
  createDebugAdapterDescriptor(
    _session: vscode.DebugSession
  ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    return new vscode.DebugAdapterInlineImplementation(new TinyCpuDebugSession());
  }
}
