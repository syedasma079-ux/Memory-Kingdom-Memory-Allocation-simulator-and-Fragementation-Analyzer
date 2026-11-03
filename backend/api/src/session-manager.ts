import { EngineBridge } from './engine-bridge.js';
import { SessionConfig, EngineEvent, EngineSnapshot } from './types.js';
import { Response } from 'express';
import crypto from 'crypto';

export interface Session {
  id: string;
  config: SessionConfig;
  bridge: EngineBridge;
  events: EngineEvent[];
  lastActive: number;
  sseClients: Response[];
  timer: NodeJS.Timeout | null;
}

export class SessionManager {
  private sessions = new Map<string, Session>();
  private readonly MAX_SESSIONS = 8;
  private readonly IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

  constructor() {
    // Periodic idle cleanup check
    setInterval(() => this.cleanupIdleSessions(), 60 * 1000).unref();
  }

  public async createSession(config: SessionConfig): Promise<Session> {
    if (this.sessions.size >= this.MAX_SESSIONS) {
      throw new Error(`Session limit reached (max ${this.MAX_SESSIONS} concurrent sessions)`);
    }

    const id = crypto.randomUUID();
    const bridge = new EngineBridge(config.engine);
    await bridge.start();

    // Initial configure command
    await bridge.sendCommand('session.configure', {
      policy: config.policy,
      quantum: config.quantum,
      totalMemory: config.totalMemory,
      demotionTrigger: config.demotionTrigger,
      admissionOrdering: config.admissionOrdering
    });

    const session: Session = {
      id,
      config,
      bridge,
      events: [],
      lastActive: Date.now(),
      sseClients: [],
      timer: null
    };

    // Forward events from C bridge to session event log and SSE clients
    bridge.on('event', (evt: EngineEvent) => {
      session.events.push(evt);
      if (session.events.length > 2000) {
        session.events.shift();
      }
      this.broadcastEvent(session, evt);
    });

    this.sessions.set(id, session);
    return session;
  }

  public getSession(id: string): Session | undefined {
    const s = this.sessions.get(id);
    if (s) {
      s.lastActive = Date.now();
    }
    return s;
  }

  public async deleteSession(id: string): Promise<boolean> {
    const s = this.sessions.get(id);
    if (!s) return false;

    if (s.timer) {
      clearInterval(s.timer);
    }

    // Close all SSE connections
    for (const res of s.sseClients) {
      try {
        res.end();
      } catch {
        // ignore
      }
    }
    s.sseClients = [];

    s.bridge.stop();
    this.sessions.delete(id);
    return true;
  }

  public addSseClient(session: Session, res: Response, lastEventId?: number): void {
    session.sseClients.push(res);

    // If Last-Event-ID provided, replay events with seq > lastEventId
    if (typeof lastEventId === 'number' && !isNaN(lastEventId)) {
      const replay = session.events.filter(e => e.seq > lastEventId);
      for (const e of replay) {
        res.write(`id: ${e.seq}\nevent: ${e.kind}\ndata: ${JSON.stringify(e)}\n\n`);
      }
    }

    reqCloseCleanup: {
      res.on('close', () => {
        session.sseClients = session.sseClients.filter(c => c !== res);
      });
    }
  }

  private broadcastEvent(session: Session, evt: EngineEvent): void {
    const sseMessage = `id: ${evt.seq}\nevent: ${evt.kind}\ndata: ${JSON.stringify(evt)}\n\n`;
    for (const client of session.sseClients) {
      try {
        client.write(sseMessage);
      } catch {
        // Handled on close
      }
    }
  }

  public getActiveCount(): number {
    return this.sessions.size;
  }

  private cleanupIdleSessions(): void {
    const now = Date.now();
    for (const [id, s] of this.sessions.entries()) {
      if (now - s.lastActive > this.IDLE_TIMEOUT_MS) {
        this.deleteSession(id).catch(err => {
          console.error(`Failed to idle-kill session ${id}:`, err);
        });
      }
    }
  }

  public async shutdown(): Promise<void> {
    for (const id of Array.from(this.sessions.keys())) {
      await this.deleteSession(id);
    }
  }
}

