import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import QRCode from 'qrcode';
import { attachSockets } from './sockets.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: false }, maxHttpBufferSize: 1e5 });

app.disable('x-powered-by');
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/qr.svg', async (req, res) => {
  const room = String(req.query.room || '').toUpperCase();
  const host = String(req.get('host') || '');
  if (!/^[A-Z2-9]{4}$/.test(room) || !/^[a-zA-Z0-9.-]+(?::\d{1,5})?$/.test(host)) {
    return res.status(400).type('text/plain').send('Invalid room code or host.');
  }
  try {
    const protocol = req.get('x-forwarded-proto') === 'https' || req.secure ? 'https' : 'http';
    const target = new URL('/', `${protocol}://${host}`);
    target.searchParams.set('room', room);
    const svg = await QRCode.toString(target.toString(), {
      type: 'svg', width: 240, margin: 1,
      color: { dark: '#0B1120', light: '#FFFFFF' }, errorCorrectionLevel: 'M'
    });
    res.set({ 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).send(svg);
  } catch {
    res.status(500).type('text/plain').send('Could not create the room QR code.');
  }
});
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
