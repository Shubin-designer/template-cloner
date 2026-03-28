import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

interface PendingRequest {
  resolve: (resp: BridgeResponse) => void;
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface BridgeResponse {
  type: string;
  requestId: string;
  data?: unknown;
  error?: string;
}

/**
 * Embedded Figma MCP Bridge server.
 * Runs on port 1994 alongside the Next.js app.
 * The Figma plugin connects here via WebSocket.
 */
class FigmaBridge {
  private wss: WebSocketServer;
  private httpServer: http.Server | null = null;
  private conn: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private counter = 0;
  private started = false;

  constructor() {
    this.wss = new WebSocketServer({ noServer: true });
  }

  isStarted(): boolean {
    return this.started;
  }

  isPluginConnected(): boolean {
    return this.conn !== null && this.conn.readyState === WebSocket.OPEN;
  }

  start(port = 1994): Promise<void> {
    if (this.started) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        // CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        if (req.url === '/ping' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'ok',
            pluginConnected: this.isPluginConnected(),
          }));
          return;
        }

        if (req.url === '/api/create-design' && req.method === 'POST') {
          this.handleCreateDesign(req, res);
          return;
        }

        res.writeHead(404);
        res.end('Not found');
      });

      server.on('upgrade', (req, socket, head) => {
        if (req.url === '/ws') {
          this.wss.handleUpgrade(req, socket, head, (ws) => {
            this.handleConnection(ws);
          });
        } else {
          socket.destroy();
        }
      });

      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          // Port already taken — another bridge is running, that's OK
          console.log(`[FigmaBridge] Port ${port} already in use, assuming external bridge`);
          this.started = true;
          resolve();
        } else {
          reject(err);
        }
      });

      server.listen(port, () => {
        this.httpServer = server;
        this.started = true;
        console.log(`[FigmaBridge] Listening on :${port}`);
        resolve();
      });
    });
  }

  private handleConnection(ws: WebSocket): void {
    if (this.conn) {
      this.conn.close();
    }
    this.conn = ws;
    console.log('[FigmaBridge] Plugin connected');

    ws.on('message', (data) => {
      try {
        const resp: BridgeResponse = JSON.parse(data.toString());
        const pending = this.pending.get(resp.requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pending.delete(resp.requestId);
          pending.resolve(resp);
        }
      } catch {
        console.error('[FigmaBridge] Invalid response from plugin');
      }
    });

    ws.on('close', () => {
      if (this.conn === ws) {
        this.conn = null;
        console.log('[FigmaBridge] Plugin disconnected');
      }
    });

    ws.on('error', (err) => {
      console.error('[FigmaBridge] WebSocket error:', err.message);
      if (this.conn === ws) this.conn = null;
    });
  }

  sendToPlugin(
    requestType: string,
    params?: Record<string, unknown>
  ): Promise<BridgeResponse> {
    return new Promise((resolve, reject) => {
      if (!this.conn || this.conn.readyState !== WebSocket.OPEN) {
        reject(new Error('Figma plugin not connected. Open the MCP Bridge plugin in Figma.'));
        return;
      }

      const requestId = this.nextId();
      const request = { type: requestType, requestId, params };

      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error('Request timed out (30s). Check the Figma plugin is running.'));
      }, 30_000);

      this.pending.set(requestId, { resolve, reject, timeout });

      this.conn.send(JSON.stringify(request), (err) => {
        if (err) {
          clearTimeout(timeout);
          this.pending.delete(requestId);
          reject(err);
        }
      });
    });
  }

  private handleCreateDesign(req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const spec = JSON.parse(body);
        if (!spec.pages || !Array.isArray(spec.pages)) {
          this.sendJSON(res, 400, { error: 'Invalid design spec: missing pages array' });
          return;
        }

        const resp = await this.sendToPlugin('create_design', spec);
        if (resp.error) {
          this.sendJSON(res, 200, { error: resp.error });
        } else {
          this.sendJSON(res, 200, { data: resp.data });
        }
      } catch (err) {
        this.sendJSON(res, 200, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  private sendJSON(res: http.ServerResponse, status: number, body: { data?: unknown; error?: string }): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  }

  private nextId(): string {
    this.counter++;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `req-${hh}${mm}${ss}-${this.counter}`;
  }
}

// Singleton — one bridge per Next.js process
let bridge: FigmaBridge | null = null;

export function getBridge(): FigmaBridge {
  if (!bridge) {
    bridge = new FigmaBridge();
  }
  return bridge;
}

export async function ensureBridgeRunning(): Promise<FigmaBridge> {
  const b = getBridge();
  if (!b.isStarted()) {
    await b.start();
  }
  return b;
}
