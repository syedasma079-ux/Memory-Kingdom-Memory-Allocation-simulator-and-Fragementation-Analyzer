import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';
import EventEmitter from 'events';
import { EngineEvent, EngineSnapshot } from './types.js';

interface PendingRequest {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export class EngineBridge extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private stdoutBuffer = '';
  private isAlive = false;

  constructor(
    private readonly binaryType: 'sim' | 'dispatch' = 'sim',
    private readonly binaryDir: string = path.resolve(process.cwd(), '../c-engine')
  ) {
    super();
  }

  public async start(): Promise<void> {
    const binaryName = this.binaryType === 'dispatch' ? 'memk-dispatch' : 'memk-sim';
    const binaryPath = path.join(this.binaryDir, binaryName);

    // Fixed argv: spawn with { shell: false }
    const argv = this.binaryType === 'sim' ? ['--server'] : ['--speed', '10.0'];

    this.child = spawn(binaryPath, argv, { shell: false });
    this.isAlive = true;

    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => {
      this.handleStdout(chunk);
    });

    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', (chunk: string) => {
      // Stderr is log output only per Section 5
      console.error(`[C-Engine ${binaryName}]:`, chunk.trim());
    });

    this.child.on('error', (err: Error) => {
      this.isAlive = false;
      this.emit('error', err);
    });

    this.child.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      this.isAlive = false;
      for (const [id, req] of this.pending.entries()) {
        clearTimeout(req.timer);
        req.reject(new Error(`C engine exited before reply (code ${code}, signal ${signal})`));
      }
      this.pending.clear();
      this.emit('exit', { code, signal });
    });
  }

  private handleStdout(chunk: string): void {
    this.stdoutBuffer += chunk;
    if (this.stdoutBuffer.length > 1024 * 1024 * 4) {
      // Exceeded max line buffer limit
      this.stdoutBuffer = '';
      return;
    }

    let newlineIndex: number;
    while ((newlineIndex = this.stdoutBuffer.indexOf('\n')) !== -1) {
      const line = this.stdoutBuffer.slice(0, newlineIndex).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);

      if (line.length === 0) continue;

      try {
        const msg = JSON.parse(line);
        if (msg.type === 'reply') {
          const req = this.pending.get(msg.id);
          if (req) {
            clearTimeout(req.timer);
            this.pending.delete(msg.id);
            if (msg.ok) {
              req.resolve(msg.data);
            } else {
              req.reject(new Error(msg.error || 'Command failed in C engine'));
            }
          }
        } else if (msg.type === 'event') {
          const event: EngineEvent = msg;
          this.emit('event', event);
        }
      } catch (err) {
        console.error('[EngineBridge] Failed to parse JSON line:', line, err);
      }
    }
  }

  public async sendCommand<T = unknown>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
    if (!this.child || !this.isAlive) {
      throw new Error('C simulation engine is not running');
    }

    const id = this.nextId++;
    const payload = JSON.stringify({ id, cmd, ...args });

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Command timeout waiting for C engine reply (${cmd})`));
      }, 5000);

      this.pending.set(id, {
        resolve: resolve as (data: unknown) => void,
        reject,
        timer
      });

      this.child!.stdin.write(payload + '\n');
    });
  }

  public async getSnapshot(): Promise<EngineSnapshot> {
    return this.sendCommand<EngineSnapshot>('snapshot.get');
  }

  public stop(): void {
    if (this.child && this.isAlive) {
      this.child.kill('SIGINT');
      setTimeout(() => {
        if (this.child && this.isAlive) {
          this.child.kill('SIGKILL');
        }
      }, 500);
    }
    this.isAlive = false;
  }
}

