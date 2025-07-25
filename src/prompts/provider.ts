import type { PromptProvider } from '../core/server.js';
import type { McpPrompt, McpPromptMessage } from '../core/types.js';
import { PromptNotFoundError, InvalidParamsError } from '../core/errors.js';
import type { PromptRegistry, PromptDefinition } from './types.js';
import { DefaultPromptRegistry } from './registry.js';
import { PromptValidator } from './validation.js';

export class McpPromptProvider implements PromptProvider {
  private registry: PromptRegistry;

  constructor(registry?: PromptRegistry) {
    this.registry = registry ?? new DefaultPromptRegistry();
  }

  async listPrompts(): Promise<McpPrompt[]> {
    return this.registry.list();
  }

  async getPrompt(name: string, args: Record<string, unknown> = {}): Promise<McpPromptMessage[]> {
    const prompt = this.registry.get(name);
    if (!prompt) {
      throw new PromptNotFoundError(name);
    }

    // Validate arguments
    const validation = PromptValidator.validateArguments(args, prompt.arguments);
    if (!validation.valid) {
      throw new InvalidParamsError(`Invalid prompt arguments: ${validation.errors.join(', ')}`);
    }

    // Sanitize arguments
    const sanitizedArgs = PromptValidator.sanitizeArgs(args);

    try {
      return await prompt.handler(sanitizedArgs);
    } catch (error) {
      throw new InvalidParamsError(
        `Error executing prompt ${name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  registerPrompt(prompt: PromptDefinition): void {
    const nameValidation = PromptValidator.validatePromptName(prompt.name);
    if (!nameValidation.valid) {
      throw new Error(`Invalid prompt name: ${nameValidation.errors.join(', ')}`);
    }

    this.registry.register(prompt);
  }

  unregisterPrompt(name: string): void {
    this.registry.unregister(name);
  }

  hasPrompt(name: string): boolean {
    return this.registry.has(name);
  }

  clear(): void {
    this.registry.clear();
  }
}

// Utility functions for creating common prompt patterns
export const PromptUtils = {
  createUserMessage(text: string): McpPromptMessage {
    return {
      role: 'user',
      content: {
        type: 'text',
        text,
      },
    };
  },

  createAssistantMessage(text: string): McpPromptMessage {
    return {
      role: 'assistant',
      content: {
        type: 'text',
        text,
      },
    };
  },

  createConversation(
    messages: Array<{ role: 'user' | 'assistant'; text: string }>,
  ): McpPromptMessage[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: {
        type: 'text',
        text: msg.text,
      },
    }));
  },

  interpolateTemplate(template: string, args: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = args[key];
      return value !== undefined ? String(value) : match;
    });
  },
};
