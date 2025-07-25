import type { McpPrompt, McpPromptArgument, McpPromptMessage } from '../core/types.js';

export interface PromptDefinition {
  name: string;
  description?: string;
  arguments?: McpPromptArgument[];
  handler: (args: Record<string, unknown>) => Promise<McpPromptMessage[]> | McpPromptMessage[];
}

export interface PromptRegistry {
  register(prompt: PromptDefinition): void;
  unregister(name: string): void;
  list(): McpPrompt[];
  get(name: string): PromptDefinition | undefined;
  has(name: string): boolean;
  clear(): void;
}

export interface PromptTemplateContext {
  args: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
}

export type PromptTemplate = (context: PromptTemplateContext) => McpPromptMessage[];

export interface PromptValidationResult {
  valid: boolean;
  errors: string[];
}
