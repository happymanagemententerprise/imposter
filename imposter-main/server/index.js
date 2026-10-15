import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { attachSockets } from './sockets.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: false }, maxHttpBufferSize: 1e5 });

app.disable('x-powered-by');
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use(express.static(join(root, 'public')));
app.get('/tv', (_req, res) => res.sendFile(join(root, 'public', 'tv', 'index.html')));
app.get('/', (_req, res) => res.sendFile(join(root, 'public', 'phone', 'index.html')));

attachSockets(io);
const port = Number(process.env.PORT) || 3000;
server.listen(port, '0.0.0.0', () => console.log(`Impostor Game listening on ${port}`));

function shutdown() {
  io.close(() => server.close(() => process.exit(0)));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
