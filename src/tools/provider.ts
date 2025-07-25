import { InvalidParamsError, ToolExecutionError } from '../core/errors.js';
import type { ToolProvider } from '../core/server.js';
import type { McpTool } from '../core/types.js';
import { ToolMiddlewareChain } from './middleware.js';
import { DefaultToolRegistry } from './registry.js';
import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolMiddleware,
  ToolOptions,
  ToolRegistry,
} from './types.js';
import { ToolValidator } from './validation.js';

export class McpToolProvider implements ToolProvider {
  private registry: ToolRegistry;
  private middlewareChain: ToolMiddlewareChain;
  private requestIdCounter = 0;

  constructor(registry?: ToolRegistry) {
    this.registry = registry ?? new DefaultToolRegistry();
    this.middlewareChain = new ToolMiddlewareChain();
  }

  async listTools(): Promise<McpTool[]> {
    return this.registry.list();
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.registry.get(name);
    if (!tool) {
      throw new ToolExecutionError(name, 'Tool not found');
    }

    // Validate arguments against schema
    const validation = ToolValidator.validateArgs(args, tool.inputSchema);
    if (!validation.valid) {
      throw new InvalidParamsError(`Invalid tool arguments: ${validation.errors.join(', ')}`);
    }

    // Sanitize arguments
    const sanitizedArgs = ToolValidator.sanitizeArgs(args);

    // Create execution context
    const context: ToolExecutionContext = {
      toolName: name,
      args: sanitizedArgs,
      timestamp: new Date().toISOString(),
      requestId: `req_${++this.requestIdCounter}`,
    };

    // Execute through middleware chain
    try {
      return await this.middlewareChain.execute(context, async () => {
        return await tool.handler(sanitizedArgs);
      });
    } catch (error) {
      throw new ToolExecutionError(name, error instanceof Error ? error.message : String(error));
    }
  }

  registerTool(tool: ToolDefinition, options: ToolOptions = {}): void {
    // Validate tool definition
    const nameValidation = ToolValidator.validateToolName(tool.name);
    if (!nameValidation.valid) {
      throw new Error(`Invalid tool name: ${nameValidation.errors.join(', ')}`);
    }

    const schemaValidation = ToolValidator.validateInputSchema(tool.inputSchema);
    if (!schemaValidation.valid) {
      throw new Error(`Invalid input schema: ${schemaValidation.errors.join(', ')}`);
    }

    // Add metadata from options
    const enhancedTool: ToolDefinition = {
      ...tool,
      metadata: {
        ...tool.metadata,
        security: options.security,
        timeout: options.timeout,
        rateLimit: options.rateLimit,
        requiresConfirmation: options.requiresConfirmation,
      },
    };

    this.registry.register(enhancedTool);
  }

  unregisterTool(name: string): void {
    this.registry.unregister(name);
  }

  hasTool(name: string): boolean {
    return this.registry.has(name);
  }

  clear(): void {
    this.registry.clear();
    this.middlewareChain = new ToolMiddlewareChain();
  }

  // Middleware management
  use(middleware: ToolMiddleware): this {
    this.middlewareChain.use(middleware);
    return this;
  }

  // Utility methods for creating common tool patterns
  static createSimpleTool(
    name: string,
    description: string,
    handler: (args: Record<string, unknown>) => Promise<unknown> | unknown,
    inputSchema?: Record<string, unknown>,
  ): ToolDefinition {
    return {
      name,
      description,
      inputSchema: inputSchema ?? {
        type: 'object',
        properties: {},
        required: [],
      },
      handler,
    };
  }

  static createParameterizedTool(
    name: string,
    description: string,
    parameters: Array<{
      name: string;
      type: string;
      description?: string;
      required?: boolean;
      default?: unknown;
    }>,
    handler: (args: Record<string, unknown>) => Promise<unknown> | unknown,
  ): ToolDefinition {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const param of parameters) {
      properties[param.name] = {
        type: param.type,
        description: param.description,
      };

      if (param.default !== undefined) {
        properties[param.name].default = param.default;
      }

      if (param.required === true) {
        required.push(param.name);
      }
    }

    return {
      name,
      description,
      inputSchema: {
        type: 'object',
        properties,
        required,
      },
      handler,
    };
  }

  static createAsyncTool(
    name: string,
    description: string,
    asyncHandler: (args: Record<string, unknown>) => Promise<unknown>,
    inputSchema?: Record<string, unknown>,
  ): ToolDefinition {
    return {
      name,
      description,
      inputSchema: inputSchema ?? {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: asyncHandler,
    };
  }
}
