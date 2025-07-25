import type { JsonRpcMessage } from '../core/types.js';

export interface Transport {
  send(message: JsonRpcMessage): Promise<void>;
  onMessage(handler: (message: JsonRpcMessage) => void): void;
  close(): Promise<void>;
  isConnected(): boolean;
}

export interface TransportOptions {
  timeout?: number;
  maxMessageSize?: number;
  encoding?: BufferEncoding;
}

export interface StdioTransportOptions extends TransportOptions {
  stdin?: NodeJS.ReadableStream;
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
}

export interface HttpTransportOptions extends TransportOptions {
  port?: number;
  host?: string;
  path?: string;
  cors?: {
    origin?: string | string[];
    credentials?: boolean;
  };
  headers?: Record<string, string>;
}

export interface TransportMetrics {
  messagesSent: number;
  messagesReceived: number;
  bytesReceived: number;
  bytesSent: number;
  errors: number;
  connectionTime?: number;
}
