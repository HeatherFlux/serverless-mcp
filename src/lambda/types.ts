import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

export interface StreamifyResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
  // AWS Lambda streaming extensions
  write?: (chunk: string) => void;
  end?: () => void;
}

export type LambdaStreamingHandler = (
  event: APIGatewayProxyEvent,
  context: Context,
) => Promise<StreamifyResponse> | StreamifyResponse;

export interface LambdaTransportOptions {
  cors?: {
    origin?: string | string[];
    credentials?: boolean;
    maxAge?: number;
  };
  maxMessageSize?: number;
  timeout?: number;
  enableMetrics?: boolean;
  enableLogs?: boolean;
}

export interface LambdaInvocationContext {
  requestId: string;
  functionName: string;
  functionVersion: string;
  memoryLimitInMB: string;
  remainingTimeInMillis: number;
}

export interface LambdaMcpEvent {
  httpMethod: 'POST' | 'GET' | 'OPTIONS';
  path: string;
  headers: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
  queryStringParameters?: Record<string, string>;
}

export type LambdaStreamingCallback = (error: Error | null, result?: StreamifyResponse) => void;
