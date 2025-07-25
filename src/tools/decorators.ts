import type { ToolDefinition, ToolOptions } from './types.js';

export interface ToolDecoratorOptions extends ToolOptions {
  name?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface ToolMetadata {
  tools: Map<string, ToolDefinition>;
}

const TOOL_METADATA_KEY = Symbol('tools');

export function getToolMetadata(target: any): ToolMetadata {
  if (!target[TOOL_METADATA_KEY]) {
    target[TOOL_METADATA_KEY] = {
      tools: new Map<string, ToolDefinition>(),
    };
  }
  return target[TOOL_METADATA_KEY];
}

export function tool(options: ToolDecoratorOptions = {}) {
  return (target: any, propertyKey: string, descriptor?: PropertyDescriptor) => {
    // Handle both legacy and modern decorator APIs
    const originalMethod = descriptor?.value ?? target[propertyKey];

    if (typeof originalMethod !== 'function') {
      throw new Error('@tool can only be applied to methods');
    }

    const toolName = options.name ?? propertyKey;
    const inputSchema = options.inputSchema ?? {
      type: 'object',
      properties: {},
      required: [],
    };

    // Store tool metadata
    const metadata = getToolMetadata(target.constructor);
    metadata.tools.set(toolName, {
      name: toolName,
      description: options.description,
      inputSchema,
      handler: originalMethod,
      metadata: {
        security: options.security,
        timeout: options.timeout,
        rateLimit: options.rateLimit,
        requiresConfirmation: options.requiresConfirmation,
      },
    });

    // Return original descriptor
    return descriptor;
  };
}

// Parameter decorator helper
export function param(
  name: string,
  type: string,
  options: {
    description?: string;
    required?: boolean;
    default?: unknown;
    minimum?: number;
    maximum?: number;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  } = {},
) {
  return (decoratorOptions: ToolDecoratorOptions = {}): ToolDecoratorOptions => {
    const schema = decoratorOptions.inputSchema ?? {
      type: 'object',
      properties: {},
      required: [],
    };

    const properties = (schema.properties as Record<string, any>) ?? {};
    const required = (schema.required as string[]) ?? [];

    // Add property to schema
    properties[name] = {
      type,
      description: options.description,
      ...(options.default !== undefined && { default: options.default }),
      ...(options.minimum !== undefined && { minimum: options.minimum }),
      ...(options.maximum !== undefined && { maximum: options.maximum }),
      ...(options.pattern !== undefined && { pattern: options.pattern }),
      ...(options.minLength !== undefined && { minLength: options.minLength }),
      ...(options.maxLength !== undefined && { maxLength: options.maxLength }),
    };

    // Add to required array if specified
    if (options.required === true && !required.includes(name)) {
      required.push(name);
    }

    return {
      ...decoratorOptions,
      inputSchema: {
        ...schema,
        properties,
        required,
      },
    };
  };
}

// Helper to create tool handler classes
export abstract class ToolHandler {
  getTools(): ToolDefinition[] {
    const metadata = getToolMetadata(this.constructor);
    return Array.from(metadata.tools.values());
  }

  getTool(name: string): ToolDefinition | undefined {
    const metadata = getToolMetadata(this.constructor);
    return metadata.tools.get(name);
  }

  hasTool(name: string): boolean {
    const metadata = getToolMetadata(this.constructor);
    return metadata.tools.has(name);
  }
}

// Convenience decorators for common security levels
export const safeTool = (options: Omit<ToolDecoratorOptions, 'security'> = {}) =>
  tool({ ...options, security: 'safe' });

export const restrictedTool = (options: Omit<ToolDecoratorOptions, 'security'> = {}) =>
  tool({ ...options, security: 'restricted' });

export const dangerousTool = (options: Omit<ToolDecoratorOptions, 'security'> = {}) =>
  tool({ ...options, security: 'dangerous' });

// Example usage:
// class MathTools extends ToolHandler {
//   @tool({
//     name: 'add',
//     description: 'Add two numbers',
//     inputSchema: {
//       type: 'object',
//       properties: {
//         a: { type: 'number', description: 'First number' },
//         b: { type: 'number', description: 'Second number' }
//       },
//       required: ['a', 'b']
//     }
//   })
//   async add(args: Record<string, unknown>): Promise<number> {
//     const a = args.a as number;
//     const b = args.b as number;
//     return a + b;
//   }
//
//   @safeTool({
//     description: 'Get current timestamp',
//   })
//   async getCurrentTime(): Promise<string> {
//     return new Date().toISOString();
//   }
// }
