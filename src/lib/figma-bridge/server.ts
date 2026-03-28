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

const BRIDGE_PORT = 1994;

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
  private ownsPort = false; // true if WE started the HTTP server

  constructor() {
    this.wss = new WebSocketServer({ noServer: true });
  }

  isStarted(): boolean {
    return this.started;
  }

  isPluginConnected(): boolean {
    return this.conn !== null && this.conn.readyState === WebSocket.OPEN;
  }

  start(): Promise<void> {
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
          // Port already taken — external bridge is running
          console.log(`[FigmaBridge] Port ${BRIDGE_PORT} in use, will proxy to external bridge`);
          this.ownsPort = false;
          this.started = true;
          resolve();
        } else {
          reject(err);
        }
      });

      server.listen(BRIDGE_PORT, () => {
        this.httpServer = server;
        this.ownsPort = true;
        this.started = true;
        console.log(`[FigmaBridge] Listening on :${BRIDGE_PORT}`);
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

  /**
   * Check if plugin is connected — either locally or via external bridge.
   */
  async checkPluginConnected(): Promise<boolean> {
    if (this.isPluginConnected()) return true;

    // If we don't own the port, check external bridge
    if (!this.ownsPort) {
      return this.pingExternalBridge();
    }

    return false;
  }

  private async pingExternalBridge(): Promise<boolean> {
    try {
      const res = await fetch(`http://localhost:${BRIDGE_PORT}/ping`, {
        signal: AbortSignal.timeout(2000),
      });
      const data = await res.json();
      return data.pluginConnected === true;
    } catch {
      return false;
    }
  }

  /**
   * Send create_design to plugin — either directly or via external bridge.
   */
  async createDesign(spec: Record<string, unknown>): Promise<{ data?: unknown; error?: string }> {
    // Direct connection
    if (this.isPluginConnected()) {
      try {
        const resp = await this.sendToPlugin('create_design', spec);
        if (resp.error) return { error: resp.error };
        return { data: resp.data };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }

    // Proxy to external bridge
    if (!this.ownsPort) {
      return this.proxyCreateDesign(spec);
    }

    return { error: 'Figma plugin not connected. Open the SiteCloner Bridge plugin in Figma.' };
  }

  private async proxyCreateDesign(spec: Record<string, unknown>): Promise<{ data?: unknown; error?: string }> {
    try {
      const res = await fetch(`http://localhost:${BRIDGE_PORT}/api/create-design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(spec),
        signal: AbortSignal.timeout(30_000),
      });
      return await res.json();
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  private sendToPlugin(
    requestType: string,
    params?: Record<string, unknown>
  ): Promise<BridgeResponse> {
    return new Promise((resolve, reject) => {
      if (!this.conn || this.conn.readyState !== WebSocket.OPEN) {
        reject(new Error('Figma plugin not connected'));
        return;
      }

      const requestId = this.nextId();
      const request = { type: requestType, requestId, params };

      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error('Request timed out (120s). Large sites may take longer.'));
      }, 120_000);

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
        const result = await this.createDesign(spec);
        const status = result.error ? 200 : 200;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    });
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

// Use globalThis to survive Next.js hot-reloads in dev mode
const globalForBridge = globalThis as unknown as { __figmaBridge?: FigmaBridge };

export function getBridge(): FigmaBridge {
  if (!globalForBridge.__figmaBridge) {
    globalForBridge.__figmaBridge = new FigmaBridge();
  }
  return globalForBridge.__figmaBridge;
}

export async function ensureBridgeRunning(): Promise<FigmaBridge> {
  const b = getBridge();
  if (!b.isStarted()) {
    await b.start();
  }
  return b;
}
