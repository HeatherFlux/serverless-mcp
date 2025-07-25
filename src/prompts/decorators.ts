import type { McpPromptArgument } from '../core/types.js';
import type { PromptDefinition } from './types.js';

export interface PromptOptions {
  name?: string;
  description?: string;
  arguments?: McpPromptArgument[];
}

export interface PromptMetadata {
  prompts: Map<string, PromptDefinition>;
}

const PROMPT_METADATA_KEY = Symbol('prompts');

export function getPromptMetadata(target: any): PromptMetadata {
  if (!target[PROMPT_METADATA_KEY]) {
    target[PROMPT_METADATA_KEY] = {
      prompts: new Map<string, PromptDefinition>(),
    };
  }
  return target[PROMPT_METADATA_KEY];
}

export function prompt(options: PromptOptions = {}) {
  return function (target: any, propertyKey: string, descriptor?: PropertyDescriptor) {
    // Handle both legacy and modern decorator APIs
    const originalMethod = descriptor?.value ?? target[propertyKey];
    const promptName = options.name ?? propertyKey;

    if (typeof originalMethod !== 'function') {
      throw new Error(`@prompt can only be applied to methods`);
    }

    // Store prompt metadata
    const metadata = getPromptMetadata(target.constructor);
    metadata.prompts.set(promptName, {
      name: promptName,
      description: options.description,
      arguments: options.arguments,
      handler: originalMethod,
    });

    // Return original descriptor or undefined for modern decorators
    return descriptor;
  };
}

export function promptArg(name: string, description?: string, required = false) {
  return function (options: PromptOptions = {}): PromptOptions {
    const args = options.arguments || [];
    args.push({
      name,
      description,
      required,
    });
    return {
      ...options,
      arguments: args,
    };
  };
}

// Helper to create prompt classes
export abstract class PromptHandler {
  getPrompts(): PromptDefinition[] {
    const metadata = getPromptMetadata(this.constructor);
    return Array.from(metadata.prompts.values());
  }

  getPrompt(name: string): PromptDefinition | undefined {
    const metadata = getPromptMetadata(this.constructor);
    return metadata.prompts.get(name);
  }

  hasPrompt(name: string): boolean {
    const metadata = getPromptMetadata(this.constructor);
    return metadata.prompts.has(name);
  }
}

// Example usage:
// class MyPrompts extends PromptHandler {
//   @prompt({
//     name: 'greeting',
//     description: 'Generate a greeting message',
//     arguments: [
//       { name: 'name', description: 'Name to greet', required: true },
//       { name: 'formal', description: 'Use formal greeting', required: false }
//     ]
//   })
//   async greeting(args: Record<string, unknown>): Promise<McpPromptMessage[]> {
//     const name = args.name as string;
//     const formal = args.formal as boolean;
//     const greeting = formal ? `Good day, ${name}` : `Hi ${name}!`;
//
//     return [
//       {
//         role: 'user',
//         content: { type: 'text', text: greeting }
//       }
//     ];
//   }
// }
