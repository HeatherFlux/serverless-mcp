import type { ErrorCode } from './types.js';

export class McpError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'McpError';
  }

  toJsonRpcError() {
    const error: { code: ErrorCode; message: string; data?: unknown } = {
      code: this.code,
      message: this.message,
    };

    if (this.data) {
      error.data = this.data;
    }

    return error;
  }
}

export class ParseError extends McpError {
  constructor(message = 'Parse error', data?: unknown) {
    super(-32700, message, data);
    this.name = 'ParseError';
  }
}

export class InvalidRequestError extends McpError {
  constructor(message = 'Invalid Request', data?: unknown) {
    super(-32600, message, data);
    this.name = 'InvalidRequestError';
  }
}

export class MethodNotFoundError extends McpError {
  constructor(method: string, data?: unknown) {
    super(-32601, `Method not found: ${method}`, data);
    this.name = 'MethodNotFoundError';
  }
}

export class InvalidParamsError extends McpError {
  constructor(message = 'Invalid params', data?: unknown) {
    super(-32602, message, data);
    this.name = 'InvalidParamsError';
  }
}

export class InternalError extends McpError {
  constructor(message = 'Internal error', data?: unknown) {
    super(-32603, message, data);
    this.name = 'InternalError';
  }
}

export class ResourceNotFoundError extends McpError {
  constructor(uri: string, data?: unknown) {
    super(-32001, `Resource not found: ${uri}`, data);
    this.name = 'ResourceNotFoundError';
  }
}

export class ToolExecutionError extends McpError {
  constructor(toolName: string, message: string, data?: unknown) {
    super(-32002, `Tool execution error in ${toolName}: ${message}`, data);
    this.name = 'ToolExecutionError';
  }
}

export class PromptNotFoundError extends McpError {
  constructor(promptName: string, data?: unknown) {
    super(-32003, `Prompt not found: ${promptName}`, data);
    this.name = 'PromptNotFoundError';
  }
}

export class CapabilityNotSupportedError extends McpError {
  constructor(capability: string, data?: unknown) {
    super(-32004, `Capability not supported: ${capability}`, data);
    this.name = 'CapabilityNotSupportedError';
  }
}
