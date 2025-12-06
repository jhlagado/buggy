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
import * as fs from 'fs';
import * as path from 'path';
import { parseIntelHex, parseListing, ListingInfo } from './z80-loaders';
import {
  createZ80Runtime,
  Z80Runtime,
  RunResult as Z80RunResult,
} from './z80-runtime';

interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
  asm?: string;
  hex?: string;
  listing?: string;
  outputDir?: string;
  artifactBase?: string;
  entry?: number;
  stopOnEntry?: boolean;
}

const THREAD_ID = 1;

export class Z80DebugSession extends DebugSession {
  private runtime: Z80Runtime | undefined;
  private listing: ListingInfo | undefined;
  private listingPath: string | undefined;
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
    this.stopOnEntry = args.stopOnEntry !== false;
    this.haltNotified = false;
    this.breakpoints.clear();
    this.runtime = undefined;
    this.listing = undefined;
    this.listingPath = undefined;

    try {
      const { hexPath, listingPath } = this.resolveArtifacts(args);

      if (!fs.existsSync(hexPath) || !fs.existsSync(listingPath)) {
        this.sendErrorResponse(
          response,
          1,
          `Z80 artifacts not found. Expected HEX at "${hexPath}" and LST at "${listingPath}". Ensure asm80 preLaunch task ran.`
        );
        return;
      }

      const hexContent = fs.readFileSync(hexPath, 'utf-8');
      const program = parseIntelHex(hexContent);

      const listingContent = fs.readFileSync(listingPath, 'utf-8');
      this.listing = parseListing(listingContent);
      this.listingPath = listingPath;
      this.sourceFile = listingPath;

      this.runtime = createZ80Runtime(program, args.entry);

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

    if (args.breakpoints !== undefined && this.runtime !== undefined) {
      for (const bp of args.breakpoints) {
        const address = this.listing?.lineToAddress.get(bp.line);
        const valid = address !== undefined && args.source?.path === this.listingPath;
        if (valid && address !== undefined) {
          this.breakpoints.add(address);
        }
        verified.push({
          verified: Boolean(valid),
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
    if (this.runtime === undefined) {
      this.sendErrorResponse(response, 1, 'No program loaded');
      return;
    }

    const result = this.runtime.step();
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
    this.sendResponse(response);
  }

  protected stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
    _args: DebugProtocol.StackTraceArguments
  ): void {
    if (this.runtime === undefined) {
      response.body = { stackFrames: [], totalFrames: 0 };
      this.sendResponse(response);
      return;
    }

    const sourcePath = this.listingPath ?? this.sourceFile;
    const lineFromMap = this.listing?.addressToLine.get(this.runtime.getPC()) ?? 1;
    const source = new Source(path.basename(sourcePath), sourcePath);

    response.body = {
      stackFrames: [new StackFrame(0, 'main', source, lineFromMap)],
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

    if (scopeType === 'registers' && this.runtime !== undefined) {
      const regs = this.runtime.getRegisters();
      const flagByte =
        (regs.flags.S << 7) |
        (regs.flags.Z << 6) |
        (regs.flags.Y << 5) |
        (regs.flags.H << 4) |
        (regs.flags.X << 3) |
        (regs.flags.P << 2) |
        (regs.flags.N << 1) |
        regs.flags.C;
      response.body = {
        variables: [
          {
            name: 'pc',
            value: `0x${this.runtime.getPC().toString(16).padStart(4, '0')}`,
            variablesReference: 0,
          },
          {
            name: 'sp',
            value: `0x${regs.sp.toString(16).padStart(4, '0')}`,
            variablesReference: 0,
          },
          { name: 'a', value: `0x${regs.a.toString(16).padStart(2, '0')}`, variablesReference: 0 },
          { name: 'f', value: `0x${flagByte.toString(16).padStart(2, '0')}`, variablesReference: 0 },
          { name: 'b', value: `0x${regs.b.toString(16).padStart(2, '0')}`, variablesReference: 0 },
          { name: 'c', value: `0x${regs.c.toString(16).padStart(2, '0')}`, variablesReference: 0 },
          { name: 'd', value: `0x${regs.d.toString(16).padStart(2, '0')}`, variablesReference: 0 },
          { name: 'e', value: `0x${regs.e.toString(16).padStart(2, '0')}`, variablesReference: 0 },
          { name: 'h', value: `0x${regs.h.toString(16).padStart(2, '0')}`, variablesReference: 0 },
          { name: 'l', value: `0x${regs.l.toString(16).padStart(2, '0')}`, variablesReference: 0 },
          {
            name: 'ix',
            value: `0x${regs.ix.toString(16).padStart(4, '0')}`,
            variablesReference: 0,
          },
          {
            name: 'iy',
            value: `0x${regs.iy.toString(16).padStart(4, '0')}`,
            variablesReference: 0,
          },
          { name: 'i', value: `0x${regs.i.toString(16).padStart(2, '0')}`, variablesReference: 0 },
          { name: 'r', value: `0x${regs.r.toString(16).padStart(2, '0')}`, variablesReference: 0 },
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
    this.runtime = undefined;
    this.haltNotified = false;
    this.sendResponse(response);
  }

  private continueExecution(response: DebugProtocol.Response): void {
    if (this.runtime === undefined) {
      this.sendErrorResponse(response, 1, 'No program loaded');
      return;
    }

    this.sendResponse(response);
    this.runUntilStop();
  }

  private runUntilStop(): void {
    if (this.runtime === undefined) {
      return;
    }

    const result: Z80RunResult = this.runtime.runUntilStop(this.breakpoints);
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

  private resolveArtifacts(args: LaunchRequestArguments): { hexPath: string; listingPath: string } {
    let hexPath = args.hex;
    let listingPath = args.listing;

    const hexMissing = hexPath === undefined || hexPath === '';
    const listingMissing = listingPath === undefined || listingPath === '';

    if (hexMissing || listingMissing) {
      if (args.asm === undefined || args.asm === '') {
        throw new Error('Z80 runtime requires "asm" (root asm file) or explicit "hex" and "listing" paths.');
      }
      const artifactBase = args.artifactBase ?? path.basename(args.asm, path.extname(args.asm));
      const outDir = args.outputDir ?? path.dirname(args.asm);
      hexPath = path.join(outDir, `${artifactBase}.hex`);
      listingPath = path.join(outDir, `${artifactBase}.lst`);
    }

    if (
      hexPath === undefined ||
      listingPath === undefined ||
      hexPath === '' ||
      listingPath === ''
    ) {
      throw new Error('Z80 runtime requires resolvable HEX and LST paths.');
    }

    return { hexPath, listingPath };
  }
}

export class Z80DebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {
  createDebugAdapterDescriptor(
    _session: vscode.DebugSession
  ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    return new vscode.DebugAdapterInlineImplementation(new Z80DebugSession());
  }
}
