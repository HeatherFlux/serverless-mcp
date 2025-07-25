import type { McpTool } from '../core/types.js';

export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown> | unknown;
  metadata?: Record<string, unknown>;
}

export interface ToolRegistry {
  register(tool: ToolDefinition): void;
  unregister(name: string): void;
  list(): McpTool[];
  get(name: string): ToolDefinition | undefined;
  has(name: string): boolean;
  clear(): void;
}

export interface ToolExecutionContext {
  toolName: string;
  args: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
}

export type ToolMiddleware = (
  context: ToolExecutionContext,
  next: () => Promise<unknown>,
) => Promise<unknown>;

export interface ToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  executionTime?: number;
}

export interface ToolValidationResult {
  valid: boolean;
  errors: string[];
}

export type ToolSecurityLevel = 'safe' | 'restricted' | 'dangerous';

export interface ToolOptions {
  security?: ToolSecurityLevel;
  timeout?: number;
  rateLimit?: {
    maxCalls: number;
    windowMs: number;
  };
  requiresConfirmation?: boolean;
}
