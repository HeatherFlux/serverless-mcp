import { createInterface } from 'node:readline';
import { ParseError } from '../core/errors.js';
import type { JsonRpcMessage } from '../core/types.js';
import type { StdioTransportOptions, Transport, TransportMetrics } from './types.js';

export class StdioTransport implements Transport {
  private messageHandler?: (message: JsonRpcMessage) => void;
  private connected = false;
  private metrics: TransportMetrics = {
    messagesSent: 0,
    messagesReceived: 0,
    bytesReceived: 0,
    bytesSent: 0,
    errors: 0,
  };

  private readonly stdin: NodeJS.ReadableStream;
  private readonly stdout: NodeJS.WritableStream;
  private readonly stderr: NodeJS.WritableStream;
  private readonly encoding: BufferEncoding;
  private readonly maxMessageSize: number;

  constructor(options: StdioTransportOptions = {}) {
    this.stdin = options.stdin ?? process.stdin;
    this.stdout = options.stdout ?? process.stdout;
    this.stderr = options.stderr ?? process.stderr;
    this.encoding = options.encoding ?? 'utf-8';
    this.maxMessageSize = options.maxMessageSize ?? 1024 * 1024; // 1MB default

    this.setupStdin();
    this.connected = true;
    this.metrics.connectionTime = Date.now();
  }

  private setupStdin(): void {
    const readline = createInterface({
      input: this.stdin,
      output: this.stdout,
      terminal: false,
    });

    readline.on('line', (line) => {
      this.handleIncomingMessage(line);
    });

    readline.on('error', (error) => {
      this.metrics.errors++;
      this.stderr.write(`StdioTransport error: ${error.message}\n`);
    });

    this.stdin.on('end', () => {
      this.connected = false;
    });
  }

  private handleIncomingMessage(line: string): void {
    try {
      if (line.length > this.maxMessageSize) {
        throw new ParseError(`Message too large: ${line.length} bytes`);
      }

      this.metrics.bytesReceived += Buffer.byteLength(line, this.encoding);

      const message = JSON.parse(line) as JsonRpcMessage;
      this.metrics.messagesReceived++;

      if (this.messageHandler) {
        this.messageHandler(message);
      }
    } catch (error) {
      this.metrics.errors++;

      if (error instanceof SyntaxError) {
        this.stderr.write(`Invalid JSON received: ${error.message}\n`);
      } else {
        this.stderr.write(
          `Error processing message: ${error instanceof Error ? error.message : String(error)}\n`,
        );
      }
    }
  }

  async send(message: JsonRpcMessage): Promise<void> {
    if (!this.connected) {
      throw new Error('Transport is not connected');
    }

    try {
      const serialized = JSON.stringify(message);

      if (serialized.length > this.maxMessageSize) {
        throw new Error(`Message too large: ${serialized.length} bytes`);
      }

      this.metrics.bytesSent += Buffer.byteLength(serialized, this.encoding);

      await new Promise<void>((resolve, reject) => {
        this.stdout.write(`${serialized}\n`, this.encoding, (error) => {
          if (error) {
            this.metrics.errors++;
            reject(error);
          } else {
            this.metrics.messagesSent++;
            resolve();
          }
        });
      });
    } catch (error) {
      this.metrics.errors++;
      throw error;
    }
  }

  onMessage(handler: (message: JsonRpcMessage) => void): void {
    this.messageHandler = handler;
  }

  async close(): Promise<void> {
    this.connected = false;

    // Don't close stdio streams as they're shared with the process
    // Just mark as disconnected
  }

  isConnected(): boolean {
    return this.connected;
  }

  getMetrics(): TransportMetrics {
    return { ...this.metrics };
  }

  // Utility method for testing
  static createMock(
    mockStdin?: NodeJS.ReadableStream,
    mockStdout?: NodeJS.WritableStream,
    mockStderr?: NodeJS.WritableStream,
  ): StdioTransport {
    return new StdioTransport({
      stdin: mockStdin,
      stdout: mockStdout,
      stderr: mockStderr,
    });
  }
}
