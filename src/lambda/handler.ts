import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { McpServer } from '../core/server.js';
import { LambdaStreamingTransport } from './transport.js';
import type { LambdaTransportOptions, StreamifyResponse } from './types.js';

export interface LambdaMcpServerOptions {
  name: string;
  version: string;
  transport?: LambdaTransportOptions;
  enableMetrics?: boolean;
  enableLogs?: boolean;
}

export class LambdaMcpHandler {
  private server: McpServer;
  private transport: LambdaStreamingTransport;

  constructor(options: LambdaMcpServerOptions) {
    this.transport = new LambdaStreamingTransport(options.transport);
    this.server = new McpServer(this.transport, {
      name: options.name,
      version: options.version,
    });
  }

  // Get the Lambda handler function
  getHandler(): (
    event: APIGatewayProxyEvent,
    context: Context,
  ) => Promise<APIGatewayProxyResult | StreamifyResponse> {
    return this.transport.createHandler();
  }

  // Convenience method to register all providers at once
  configure(setup: (server: McpServer) => void): this {
    setup(this.server);
    return this;
  }

  // Direct access to server for advanced configuration
  getServer(): McpServer {
    return this.server;
  }

  // Get transport metrics
  getMetrics() {
    return this.transport.getMetrics();
  }

  // Create a Lambda handler with automatic setup
  static create(
    options: LambdaMcpServerOptions,
    setup?: (server: McpServer) => void,
  ): (
    event: APIGatewayProxyEvent,
    context: Context,
  ) => Promise<APIGatewayProxyResult | StreamifyResponse> {
    const handler = new LambdaMcpHandler(options);

    if (setup) {
      handler.configure(setup);
    }

    return handler.getHandler();
  }
}
