import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';
import type { JsonRpcMessage } from '../core/types.js';
import type { HttpTransportOptions, Transport, TransportMetrics } from './types.js';

export class HttpStreamingTransport implements Transport {
  private messageHandler?: (message: JsonRpcMessage) => void;
  private server?: ReturnType<typeof createServer>;
  private connections = new Set<ServerResponse>();
  private connected = false;
  private metrics: TransportMetrics = {
    messagesSent: 0,
    messagesReceived: 0,
    bytesReceived: 0,
    bytesSent: 0,
    errors: 0,
  };

  private readonly options: Required<HttpTransportOptions>;

  constructor(options: HttpTransportOptions = {}) {
    this.options = {
      port: options.port ?? 3000,
      host: options.host ?? 'localhost',
      path: options.path ?? '/mcp',
      timeout: options.timeout ?? 30000,
      maxMessageSize: options.maxMessageSize ?? 1024 * 1024,
      encoding: options.encoding ?? 'utf-8',
      cors: {
        origin: '*',
        credentials: false,
        ...options.cors,
      },
      headers: options.headers ?? {},
    };
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (error) => {
        this.metrics.errors++;
        reject(error);
      });

      this.server.listen(this.options.port, this.options.host, () => {
        this.connected = true;
        this.metrics.connectionTime = Date.now();
        resolve();
      });
    });
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    // Set CORS headers
    this.setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.url !== this.options.path) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    if (req.method === 'POST') {
      this.handlePostRequest(req, res);
    } else if (req.method === 'GET') {
      this.handleGetRequest(req, res);
    } else {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method Not Allowed');
    }
  }

  private setCorsHeaders(res: ServerResponse): void {
    const { cors } = this.options;

    if (cors.origin) {
      res.setHeader(
        'Access-Control-Allow-Origin',
        Array.isArray(cors.origin) ? cors.origin.join(',') : cors.origin,
      );
    }

    if (cors.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  private handlePostRequest(req: IncomingMessage, res: ServerResponse): void {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;

      if (body.length > this.options.maxMessageSize) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32700,
              message: 'Request too large',
            },
          }),
        );
        return;
      }
    });

    req.on('end', () => {
      try {
        this.metrics.bytesReceived += Buffer.byteLength(body, this.options.encoding);

        const message = JSON.parse(body) as JsonRpcMessage;
        this.metrics.messagesReceived++;

        if (this.messageHandler) {
          this.messageHandler(message);
        }

        // Send acknowledgment for POST requests
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'received' }));
      } catch (error) {
        this.metrics.errors++;

        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32700,
              message: 'Parse error',
              data: error instanceof Error ? error.message : String(error),
            },
          }),
        );
      }
    });

    req.on('error', (error) => {
      this.metrics.errors++;
      console.error('Request error:', error);
    });
  }

  private handleGetRequest(req: IncomingMessage, res: ServerResponse): void {
    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      ...this.options.headers,
    });

    // Send initial connection event
    res.write('event: connected\n');
    res.write('data: {"status":"connected"}\n\n');

    // Track this connection
    this.connections.add(res);

    // Handle client disconnect
    req.on('close', () => {
      this.connections.delete(res);
    });

    req.on('error', (error) => {
      this.metrics.errors++;
      this.connections.delete(res);
      console.error('SSE connection error:', error);
    });
  }

  async send(message: JsonRpcMessage): Promise<void> {
    if (!this.connected) {
      throw new Error('Transport is not connected');
    }

    const serialized = JSON.stringify(message);

    if (serialized.length > this.options.maxMessageSize) {
      throw new Error(`Message too large: ${serialized.length} bytes`);
    }

    this.metrics.bytesSent += Buffer.byteLength(serialized, this.options.encoding);

    // Send to all connected SSE clients
    const sseData = `event: message\ndata: ${serialized}\n\n`;

    for (const connection of this.connections) {
      try {
        connection.write(sseData);
        this.metrics.messagesSent++;
      } catch (error) {
        this.metrics.errors++;
        this.connections.delete(connection);
      }
    }
  }

  onMessage(handler: (message: JsonRpcMessage) => void): void {
    this.messageHandler = handler;
  }

  async close(): Promise<void> {
    this.connected = false;

    // Close all SSE connections
    for (const connection of this.connections) {
      try {
        connection.write('event: close\ndata: {"status":"closing"}\n\n');
        connection.end();
      } catch (error) {
        // Ignore errors when closing
      }
    }
    this.connections.clear();

    // Close server
    if (this.server) {
      return new Promise<void>((resolve) => {
        this.server?.close(() => {
          resolve();
        });
      });
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getMetrics(): TransportMetrics {
    return { ...this.metrics };
  }

  getConnectionCount(): number {
    return this.connections.size;
  }
}
