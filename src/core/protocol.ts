import { z } from 'zod';
import { InvalidRequestError, McpError, ParseError } from './errors.js';
import type {
  ErrorCode,
  JsonRpcMessage,
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
  McpCapabilities,
} from './types.js';
import { JsonRpcNotificationSchema, JsonRpcRequestSchema, JsonRpcResponseSchema } from './types.js';

export interface Transport {
  send(message: JsonRpcMessage): Promise<void>;
  onMessage(handler: (message: JsonRpcMessage) => void): void;
  close(): Promise<void>;
}

export interface McpServerOptions {
  name: string;
  version: string;
  capabilities?: Partial<McpCapabilities>;
  instructions?: string;
}

export type MessageHandler = (params: unknown, id?: string | number) => Promise<unknown> | unknown;

export type NotificationHandler = (params: unknown) => Promise<void> | void;

export class McpProtocol {
  private messageId = 0;
  private pendingRequests = new Map<
    string | number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
    }
  >();
  private requestHandlers = new Map<string, MessageHandler>();
  private notificationHandlers = new Map<string, NotificationHandler>();

  constructor(
    private transport: Transport,
    private options: McpServerOptions,
  ) {
    this.transport.onMessage(this.handleMessage.bind(this));
    this.setupCoreHandlers();
  }

  private setupCoreHandlers() {
    this.onRequest('initialize', this.handleInitialize.bind(this));
    this.onNotification('initialized', () => {
      // Client confirms initialization
    });
  }

  private async handleInitialize(params: unknown): Promise<unknown> {
    const parseResult = z
      .object({
        protocolVersion: z.string(),
        capabilities: z.object({}).passthrough(),
        clientInfo: z.object({
          name: z.string(),
          version: z.string(),
        }),
      })
      .safeParse(params);

    if (!parseResult.success) {
      throw new InvalidRequestError('Invalid initialize params', parseResult.error);
    }

    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        logging: {},
        prompts: {
          listChanged: true,
        },
        resources: {
          subscribe: true,
          listChanged: true,
        },
        tools: {
          listChanged: true,
        },
        roots: {
          listChanged: true,
        },
        ...this.options.capabilities,
      },
      serverInfo: {
        name: this.options.name,
        version: this.options.version,
      },
      ...(this.options.instructions && { instructions: this.options.instructions }),
    };
  }

  private async handleMessage(message: JsonRpcMessage): Promise<void> {
    try {
      await this.processMessage(message);
    } catch (error) {
      await this.handleMessageError(message, error);
    }
  }

  private async processMessage(message: JsonRpcMessage): Promise<void> {
    if (this.isRequest(message)) {
      const request = JsonRpcRequestSchema.parse(message);
      await this.handleRequest(request);
    } else if (this.isResponse(message)) {
      const response = JsonRpcResponseSchema.parse(message);
      this.handleResponse(response);
    } else if (this.isNotification(message)) {
      const notification = JsonRpcNotificationSchema.parse(message);
      await this.handleNotification(notification);
    } else {
      throw new InvalidRequestError('Invalid message format');
    }
  }

  private isRequest(message: JsonRpcMessage): boolean {
    return 'id' in message && 'method' in message;
  }

  private isResponse(message: JsonRpcMessage): boolean {
    return 'id' in message && ('result' in message || 'error' in message);
  }

  private isNotification(message: JsonRpcMessage): boolean {
    return 'method' in message && !('id' in message);
  }

  private async handleMessageError(message: JsonRpcMessage, error: unknown): Promise<void> {
    if (error instanceof z.ZodError) {
      await this.sendErrorResponse(null, new ParseError('Invalid JSON-RPC message', error));
    } else if (error instanceof McpError) {
      const id = 'id' in message ? message.id : null;
      await this.sendErrorResponse(id, error);
    } else {
      const id = 'id' in message ? message.id : null;
      await this.sendErrorResponse(
        id,
        new McpError(
          -32603 as ErrorCode,
          'Internal error',
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  }

  private async handleRequest(request: JsonRpcRequest): Promise<void> {
    const handler = this.requestHandlers.get(request.method);

    if (!handler) {
      await this.sendErrorResponse(
        request.id,
        new McpError(-32601, `Method not found: ${request.method}`),
      );
      return;
    }

    try {
      const result = await handler(request.params, request.id);
      await this.sendResponse(request.id, result);
    } catch (error) {
      if (error instanceof McpError) {
        await this.sendErrorResponse(request.id, error);
      } else {
        await this.sendErrorResponse(
          request.id,
          new McpError(
            -32603,
            'Internal error',
            error instanceof Error ? error.message : String(error),
          ),
        );
      }
    }
  }

  private handleResponse(response: JsonRpcResponse): void {
    const pending = this.pendingRequests.get(response.id as string | number);
    if (!pending) {
      return; // Ignore unknown response
    }

    this.pendingRequests.delete(response.id as string | number);

    if (response.error) {
      pending.reject(
        new McpError(response.error.code as ErrorCode, response.error.message, response.error.data),
      );
    } else {
      pending.resolve(response.result);
    }
  }

  private async handleNotification(notification: JsonRpcNotification): Promise<void> {
    const handler = this.notificationHandlers.get(notification.method);

    if (!handler) {
      // Notifications are fire-and-forget, so we don't send error responses
      return;
    }

    try {
      await handler(notification.params);
    } catch (error) {
      // Log error but don't send response for notifications
      console.error(`Error handling notification ${notification.method}:`, error);
    }
  }

  onRequest(method: string, handler: MessageHandler): void {
    this.requestHandlers.set(method, handler);
  }

  onNotification(method: string, handler: NotificationHandler): void {
    this.notificationHandlers.set(method, handler);
  }

  async sendRequest(method: string, params?: unknown): Promise<unknown> {
    const id = ++this.messageId;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      ...(params !== undefined && { params }),
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.transport.send(request).catch(reject);
    });
  }

  async sendNotification(method: string, params?: unknown): Promise<void> {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      ...(params !== undefined && { params }),
    };

    await this.transport.send(notification);
  }

  private async sendResponse(id: string | number, result: unknown): Promise<void> {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id,
      result,
    };

    await this.transport.send(response);
  }

  private async sendErrorResponse(id: string | number | null, error: McpError): Promise<void> {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: id ?? null,
      error: error.toJsonRpcError(),
    };

    await this.transport.send(response);
  }

  async close(): Promise<void> {
    await this.transport.close();
  }
}
