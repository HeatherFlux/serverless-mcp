import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import type { JsonRpcMessage } from '../core/types.js';
import type { Transport, TransportMetrics } from '../transports/types.js';
import type {
  LambdaTransportOptions,
  StreamifyResponse,
  LambdaInvocationContext,
  LambdaMcpEvent,
} from './types.js';

// AWS Lambda streaming types
interface AwsLambda {
  streamifyResponse?: (handler: any) => any;
}

export class LambdaStreamingTransport implements Transport {
  private messageHandler?: (message: JsonRpcMessage) => void;
  private connected = false;
  private currentStream?: {
    write: (chunk: string) => void;
    end: () => void;
  };
  private metrics: TransportMetrics = {
    messagesSent: 0,
    messagesReceived: 0,
    bytesReceived: 0,
    bytesSent: 0,
    errors: 0,
  };

  private readonly options: Required<LambdaTransportOptions>;

  constructor(options: LambdaTransportOptions = {}) {
    this.options = {
      cors: {
        origin: '*',
        credentials: false,
        maxAge: 86400,
        ...options.cors,
      },
      maxMessageSize: options.maxMessageSize ?? 6 * 1024 * 1024, // 6MB (Lambda limit)
      timeout: options.timeout ?? 900000, // 15 minutes max
      enableMetrics: options.enableMetrics ?? true,
      enableLogs: options.enableLogs ?? true,
    };
  }

  createHandler() {
    const handler = async (
      event: APIGatewayProxyEvent,
      context: Context,
    ): Promise<StreamifyResponse> => {
      this.connected = true;
      this.metrics.connectionTime = Date.now();

      const invocationContext: LambdaInvocationContext = {
        requestId: context.awsRequestId,
        functionName: context.functionName,
        functionVersion: context.functionVersion,
        memoryLimitInMB: context.memoryLimitInMB,
        remainingTimeInMillis: context.getRemainingTimeInMillis(),
      };

      try {
        return await this.handleLambdaEvent(event, invocationContext);
      } catch (error) {
        this.metrics.errors++;

        if (this.options.enableLogs) {
          console.error('Lambda transport error:', error);
        }

        return {
          statusCode: 500,
          headers: this.getCorsHeaders(),
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32603,
              message: 'Internal error',
              data: error instanceof Error ? error.message : String(error),
            },
          }),
        };
      }
    };

    // Use AWS Lambda response streaming if available
    const awslambda = (globalThis as any).awslambda as AwsLambda | undefined;
    if (typeof awslambda?.streamifyResponse === 'function') {
      return awslambda.streamifyResponse(handler);
    }

    // Fallback to standard Lambda handler
    return handler;
  }

  private async handleLambdaEvent(
    event: APIGatewayProxyEvent,
    context: LambdaInvocationContext,
  ): Promise<StreamifyResponse> {
    const mcpEvent: LambdaMcpEvent = {
      httpMethod: event.httpMethod as 'POST' | 'GET' | 'OPTIONS',
      path: event.path,
      headers: event.headers as Record<string, string>,
      body: event.body || undefined,
      isBase64Encoded: event.isBase64Encoded,
      queryStringParameters: (event.queryStringParameters as Record<string, string>) || undefined,
    };

    // Handle CORS preflight
    if (mcpEvent.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: this.getCorsHeaders(),
        body: '',
      };
    }

    if (mcpEvent.httpMethod === 'POST') {
      return this.handlePostRequest(mcpEvent, context);
    }

    if (mcpEvent.httpMethod === 'GET') {
      return this.handleGetRequest(mcpEvent, context);
    }

    return {
      statusCode: 405,
      headers: this.getCorsHeaders(),
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  private async handlePostRequest(
    event: LambdaMcpEvent,
    context: LambdaInvocationContext,
  ): Promise<StreamifyResponse> {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: this.getCorsHeaders(),
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32600, message: 'Invalid Request' },
        }),
      };
    }

    try {
      const body = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf-8')
        : event.body;

      if (body.length > this.options.maxMessageSize) {
        return {
          statusCode: 413,
          headers: this.getCorsHeaders(),
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32700, message: 'Request too large' },
          }),
        };
      }

      this.metrics.bytesReceived += Buffer.byteLength(body, 'utf-8');

      const message = JSON.parse(body) as JsonRpcMessage;
      this.metrics.messagesReceived++;

      if (this.messageHandler) {
        this.messageHandler(message);
      }

      return {
        statusCode: 200,
        headers: {
          ...this.getCorsHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'received', requestId: context.requestId }),
      };
    } catch (error) {
      this.metrics.errors++;

      return {
        statusCode: 400,
        headers: this.getCorsHeaders(),
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: 'Parse error',
            data: error instanceof Error ? error.message : String(error),
          },
        }),
      };
    }
  }

  private async handleGetRequest(
    _event: LambdaMcpEvent,
    context: LambdaInvocationContext,
  ): Promise<StreamifyResponse> {
    // For Lambda streaming, we need to return a streaming response
    const response: StreamifyResponse = {
      statusCode: 200,
      headers: {
        ...this.getCorsHeaders(),
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    };

    // If streaming is available, set up the stream
    if (response.write && response.end) {
      this.currentStream = {
        write: response.write,
        end: response.end,
      };

      // Send initial connection event
      this.writeSSE('connected', { status: 'connected', requestId: context.requestId });

      // Set timeout to prevent Lambda from hanging
      setTimeout(
        () => {
          this.writeSSE('timeout', { status: 'timeout' });
          this.currentStream?.end();
          this.currentStream = undefined;
        },
        Math.min(this.options.timeout, context.remainingTimeInMillis - 5000),
      );
    } else {
      // Fallback for non-streaming Lambda
      response.body = 'data: {"status":"connected"}\n\n';
    }

    return response;
  }

  private writeSSE(event: string, data: any): void {
    if (this.currentStream) {
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      this.currentStream.write(message);
    }
  }

  private getCorsHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.options.cors.origin) {
      headers['Access-Control-Allow-Origin'] = Array.isArray(this.options.cors.origin)
        ? this.options.cors.origin.join(',')
        : this.options.cors.origin;
    }

    if (this.options.cors.credentials) {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    if (this.options.cors.maxAge) {
      headers['Access-Control-Max-Age'] = this.options.cors.maxAge.toString();
    }

    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';

    return headers;
  }

  async send(message: JsonRpcMessage): Promise<void> {
    if (!this.connected) {
      throw new Error('Transport is not connected');
    }

    const serialized = JSON.stringify(message);

    if (serialized.length > this.options.maxMessageSize) {
      throw new Error(`Message too large: ${serialized.length} bytes`);
    }

    this.metrics.bytesSent += Buffer.byteLength(serialized, 'utf-8');
    this.metrics.messagesSent++;

    if (this.currentStream) {
      this.writeSSE('message', message);
    }
  }

  onMessage(handler: (message: JsonRpcMessage) => void): void {
    this.messageHandler = handler;
  }

  async close(): Promise<void> {
    this.connected = false;

    if (this.currentStream) {
      this.writeSSE('close', { status: 'closing' });
      this.currentStream.end();
      this.currentStream = undefined;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getMetrics(): TransportMetrics {
    return { ...this.metrics };
  }
}
