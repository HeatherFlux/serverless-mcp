import { z } from 'zod';

// JSON-RPC 2.0 base types
export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.unknown().optional(),
});

export const JsonRpcResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
      data: z.unknown().optional(),
    })
    .optional(),
});

export const JsonRpcNotificationSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string(),
  params: z.unknown().optional(),
});

export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;
export type JsonRpcResponse = z.infer<typeof JsonRpcResponseSchema>;
export type JsonRpcNotification = z.infer<typeof JsonRpcNotificationSchema>;
export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

// MCP Protocol specific types
export const McpCapabilitiesSchema = z.object({
  experimental: z.record(z.unknown()).optional(),
  sampling: z.object({}).optional(),
  logging: z.object({}).optional(),
  prompts: z
    .object({
      listChanged: z.boolean().optional(),
    })
    .optional(),
  resources: z
    .object({
      subscribe: z.boolean().optional(),
      listChanged: z.boolean().optional(),
    })
    .optional(),
  tools: z
    .object({
      listChanged: z.boolean().optional(),
    })
    .optional(),
  roots: z
    .object({
      listChanged: z.boolean().optional(),
    })
    .optional(),
});

export const McpImplementationSchema = z.object({
  name: z.string(),
  version: z.string(),
});

export const McpInitializeParamsSchema = z.object({
  protocolVersion: z.string(),
  capabilities: McpCapabilitiesSchema,
  clientInfo: McpImplementationSchema,
});

export const McpInitializeResultSchema = z.object({
  protocolVersion: z.string(),
  capabilities: McpCapabilitiesSchema,
  serverInfo: McpImplementationSchema,
  instructions: z.string().optional(),
});

// Resource types
export const McpResourceSchema = z.object({
  uri: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
});

export const McpResourceContentsSchema = z.object({
  uri: z.string(),
  mimeType: z.string().optional(),
  text: z.string().optional(),
  blob: z.string().optional(), // Base64 encoded
});

// Tool types
export const McpToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.record(z.unknown()),
});

// Prompt types
export const McpPromptArgumentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  required: z.boolean().optional(),
});

export const McpPromptSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  arguments: z.array(McpPromptArgumentSchema).optional(),
});

export const McpPromptMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.object({
    type: z.literal('text'),
    text: z.string(),
  }),
});

// Root types
export const McpRootSchema = z.object({
  uri: z.string(),
  name: z.string().optional(),
});

// Logging types
export const McpLogLevelSchema = z.enum([
  'debug',
  'info',
  'notice',
  'warning',
  'error',
  'critical',
  'alert',
  'emergency',
]);

export const McpLogMessageSchema = z.object({
  level: McpLogLevelSchema,
  data: z.unknown(),
  logger: z.string().optional(),
});

// Sampling types
export const McpSamplingMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.object({
    type: z.literal('text'),
    text: z.string(),
  }),
});

// Export all inferred types
export type McpCapabilities = z.infer<typeof McpCapabilitiesSchema>;
export type McpImplementation = z.infer<typeof McpImplementationSchema>;
export type McpInitializeParams = z.infer<typeof McpInitializeParamsSchema>;
export type McpInitializeResult = z.infer<typeof McpInitializeResultSchema>;
export type McpResource = z.infer<typeof McpResourceSchema>;
export type McpResourceContents = z.infer<typeof McpResourceContentsSchema>;
export type McpTool = z.infer<typeof McpToolSchema>;
export type McpPrompt = z.infer<typeof McpPromptSchema>;
export type McpPromptArgument = z.infer<typeof McpPromptArgumentSchema>;
export type McpPromptMessage = z.infer<typeof McpPromptMessageSchema>;
export type McpRoot = z.infer<typeof McpRootSchema>;
export type McpLogLevel = z.infer<typeof McpLogLevelSchema>;
export type McpLogMessage = z.infer<typeof McpLogMessageSchema>;
export type McpSamplingMessage = z.infer<typeof McpSamplingMessageSchema>;

// Error codes following JSON-RPC spec and MCP extensions
export const JSON_RPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export const MCP_ERROR_CODES = {
  RESOURCE_NOT_FOUND: -32001,
  TOOL_EXECUTION_ERROR: -32002,
  PROMPT_NOT_FOUND: -32003,
  CAPABILITY_NOT_SUPPORTED: -32004,
} as const;

export type ErrorCode =
  | (typeof JSON_RPC_ERROR_CODES)[keyof typeof JSON_RPC_ERROR_CODES]
  | (typeof MCP_ERROR_CODES)[keyof typeof MCP_ERROR_CODES];
