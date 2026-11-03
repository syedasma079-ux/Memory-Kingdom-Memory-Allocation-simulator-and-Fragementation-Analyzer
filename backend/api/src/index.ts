import { createApp } from './app.js';

const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = '127.0.0.1'; // 127.0.0.1 only per Section 5 specification

const { app, sessionManager } = createApp();

const server = app.listen(PORT, HOST, () => {
  console.log(`[MEMORY KINGDOM API] listening on http://${HOST}:${PORT}`);
});

const handleShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}, shutting down sessions...`);
  await sessionManager.shutdown();
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

