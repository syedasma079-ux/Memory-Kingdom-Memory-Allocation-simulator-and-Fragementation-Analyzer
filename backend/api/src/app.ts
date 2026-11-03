import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { SessionManager } from './session-manager.js';
import { SessionConfigSchema, CommandPayloadSchema } from './types.js';
import { generateReport } from './report-generator.js';

export function createApp(sessionManager: SessionManager = new SessionManager()) {
  const app = express();

  // Strict CORS for local dev origin
  app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true
  }));

  // Limit body size to 256 KB per Section 5 hardening
  app.use(express.json({ limit: '256kb' }));

  // Health endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      activeSessions: sessionManager.getActiveCount()
    });
  });

  // Standard assignment dataset
  app.get('/api/dataset/assignment', (_req: Request, res: Response) => {
    const dataset = [
      { arrival: 0, priority: 1, cpuBurst: 1, memMb: 192, name: 'P0' },
      { arrival: 0, priority: 1, cpuBurst: 3, memMb: 32,  name: 'P1' },
      { arrival: 0, priority: 1, cpuBurst: 1, memMb: 416, name: 'P2' },
      { arrival: 0, priority: 1, cpuBurst: 3, memMb: 32,  name: 'P3' },
      { arrival: 0, priority: 1, cpuBurst: 1, memMb: 160, name: 'P4' },
      { arrival: 0, priority: 1, cpuBurst: 3, memMb: 128, name: 'P5' },
      { arrival: 7, priority: 1, cpuBurst: 2, memMb: 108, name: 'P6' },
      { arrival: 7, priority: 1, cpuBurst: 2, memMb: 256, name: 'P7' },
      { arrival: 7, priority: 1, cpuBurst: 2, memMb: 80,  name: 'P8' }
    ];
    res.json({ ok: true, data: dataset });
  });

  // Create session
  app.post('/api/sessions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsedConfig = SessionConfigSchema.parse(req.body || {});
      const session = await sessionManager.createSession(parsedConfig);
      res.status(201).json({
        ok: true,
        data: {
          id: session.id,
          config: session.config
        }
      });
    } catch (err) {
      next(err);
    }
  });

  // Delete session
  app.delete('/api/sessions/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deleted = await sessionManager.deleteSession(req.params.id);
      if (!deleted) {
        res.status(404).json({ ok: false, error: 'Session not found' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // Send command to session
  app.post('/api/sessions/:id/commands', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = sessionManager.getSession(req.params.id);
      if (!session) {
        res.status(404).json({ ok: false, error: 'Session not found' });
        return;
      }

      const payload = CommandPayloadSchema.parse(req.body);
      const { cmd, ...args } = payload;
      const result = await session.bridge.sendCommand(cmd, args as Record<string, unknown>);
      res.json({ ok: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // Get session snapshot
  app.get('/api/sessions/:id/snapshot', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = sessionManager.getSession(req.params.id);
      if (!session) {
        res.status(404).json({ ok: false, error: 'Session not found' });
        return;
      }

      const snapshot = await session.bridge.getSnapshot();
      res.json({ ok: true, data: snapshot });
    } catch (err) {
      next(err);
    }
  });

  // Server-Sent Events (SSE)
  app.get('/api/sessions/:id/events', (req: Request, res: Response) => {
    const session = sessionManager.getSession(req.params.id);
    if (!session) {
      res.status(404).json({ ok: false, error: 'Session not found' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const lastEventId = req.headers['last-event-id']
      ? parseInt(req.headers['last-event-id'] as string, 10)
      : undefined;

    sessionManager.addSseClient(session, res, lastEventId);

    // 15-second heartbeat per Section 5 specification
    const heartbeatTimer = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000);

    res.on('close', () => {
      clearInterval(heartbeatTimer);
    });
  });

  // Report export
  app.get('/api/sessions/:id/report', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = sessionManager.getSession(req.params.id);
      if (!session) {
        res.status(404).json({ ok: false, error: 'Session not found' });
        return;
      }

      const format = (req.query.format as 'json' | 'md' | 'csv') || 'json';
      const snapshot = await session.bridge.getSnapshot();
      const report = generateReport(session, snapshot, format);

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
      } else if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
      } else {
        res.setHeader('Content-Type', 'text/markdown');
      }
      res.send(report);
    } catch (err) {
      next(err);
    }
  });

  // Four-policy comparison endpoint
  app.post('/api/compare', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Create temporary session to run compare.run in C
      const session = await sessionManager.createSession(SessionConfigSchema.parse({}));
      try {
        if (req.body?.jobs) {
          await session.bridge.sendCommand('workload.load', { jobs: req.body.jobs });
        } else {
          await session.bridge.sendCommand('workload.assignment');
        }
        const result = await session.bridge.sendCommand('compare.run');
        res.json({ ok: true, data: result });
      } finally {
        await sessionManager.deleteSession(session.id);
      }
    } catch (err) {
      next(err);
    }
  });

  // Error handling middleware
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    res.status(400).json({ ok: false, error: message });
  });

  return { app, sessionManager };
}

