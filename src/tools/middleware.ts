import type { ToolExecutionContext, ToolMiddleware } from './types.js';

export class ToolMiddlewareChain {
  private middlewares: ToolMiddleware[] = [];

  use(middleware: ToolMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  async execute(
    context: ToolExecutionContext,
    finalHandler: () => Promise<unknown>,
  ): Promise<unknown> {
    let index = 0;

    const next = async (): Promise<unknown> => {
      if (index >= this.middlewares.length) {
        return finalHandler();
      }

      const middleware = this.middlewares[index++];
      return middleware?.(context, next) ?? Promise.resolve();
    };

    return next();
  }
}

// Built-in middleware implementations
export const createTimingMiddleware = (): ToolMiddleware => {
  return async (context, next) => {
    const start = Date.now();
    try {
      const result = await next();
      const executionTime = Date.now() - start;
      console.log(`Tool ${context.toolName} executed in ${executionTime}ms`);
      return result;
    } catch (error) {
      const executionTime = Date.now() - start;
      console.log(`Tool ${context.toolName} failed after ${executionTime}ms`);
      throw error;
    }
  };
};

export const createLoggingMiddleware = (
  logger: (level: string, message: string, meta?: any) => void = console.log,
): ToolMiddleware => {
  return async (context, next) => {
    logger('info', `Executing tool: ${context.toolName}`, {
      args: context.args,
      timestamp: context.timestamp,
      requestId: context.requestId,
    });

    try {
      const result = await next();
      logger('info', `Tool ${context.toolName} completed successfully`);
      return result;
    } catch (error) {
      logger('error', `Tool ${context.toolName} failed`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
};

export const createTimeoutMiddleware = (timeoutMs: number): ToolMiddleware => {
  return async (context, next) => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Tool ${context.toolName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([next(), timeoutPromise]);
  };
};

export const createRateLimitMiddleware = (maxCalls: number, windowMs: number): ToolMiddleware => {
  const callCounts = new Map<string, { count: number; resetTime: number }>();

  return async (context, next) => {
    const now = Date.now();
    const key = context.toolName;
    const current = callCounts.get(key);

    if (!current || now > current.resetTime) {
      // Reset or initialize counter
      callCounts.set(key, { count: 1, resetTime: now + windowMs });
    } else if (current.count >= maxCalls) {
      throw new Error(
        `Rate limit exceeded for tool ${context.toolName}. Max ${maxCalls} calls per ${windowMs}ms`,
      );
    } else {
      current.count++;
    }

    return next();
  };
};

export const createSecurityMiddleware = (
  allowedTools: Set<string> = new Set(),
  dangerousTools: Set<string> = new Set(),
): ToolMiddleware => {
  return async (context, next) => {
    const toolName = context.toolName;

    // Check if tool is explicitly blocked
    if (dangerousTools.has(toolName)) {
      throw new Error(`Tool ${toolName} is blocked for security reasons`);
    }

    // Check if tool is in allowlist (if allowlist is not empty)
    if (allowedTools.size > 0 && !allowedTools.has(toolName)) {
      throw new Error(`Tool ${toolName} is not in the allowed tools list`);
    }

    return next();
  };
};

export const createValidationMiddleware = (): ToolMiddleware => {
  return async (context, next) => {
    // Basic argument validation - could be extended
    if (!context.args || typeof context.args !== 'object') {
      throw new Error('Tool arguments must be a valid object');
    }

    return next();
  };
};
