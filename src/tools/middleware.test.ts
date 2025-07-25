import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ToolMiddlewareChain,
  createTimingMiddleware,
  createLoggingMiddleware,
  createTimeoutMiddleware,
  createRateLimitMiddleware,
  createSecurityMiddleware,
} from './middleware.js';
import type { ToolExecutionContext } from './types.js';

describe('ToolMiddleware', () => {
  let context: ToolExecutionContext;

  beforeEach(() => {
    context = {
      toolName: 'test-tool',
      args: { input: 'test' },
      timestamp: new Date().toISOString(),
      requestId: 'req_123',
    };
  });

  describe('ToolMiddlewareChain', () => {
    it('should execute middleware in order', async () => {
      const chain = new ToolMiddlewareChain();
      const executionOrder: string[] = [];

      const middleware1 = vi.fn(async (context, next) => {
        executionOrder.push('middleware1-before');
        const result = await next();
        executionOrder.push('middleware1-after');
        return result;
      });

      const middleware2 = vi.fn(async (context, next) => {
        executionOrder.push('middleware2-before');
        const result = await next();
        executionOrder.push('middleware2-after');
        return result;
      });

      const finalHandler = vi.fn(async () => {
        executionOrder.push('handler');
        return 'final result';
      });

      chain.use(middleware1).use(middleware2);

      const result = await chain.execute(context, finalHandler);

      expect(result).toBe('final result');
      expect(executionOrder).toEqual([
        'middleware1-before',
        'middleware2-before',
        'handler',
        'middleware2-after',
        'middleware1-after',
      ]);
    });

    it('should handle middleware errors', async () => {
      const chain = new ToolMiddlewareChain();

      const errorMiddleware = vi.fn(async () => {
        throw new Error('Middleware error');
      });

      const finalHandler = vi.fn(async () => 'result');

      chain.use(errorMiddleware);

      await expect(chain.execute(context, finalHandler)).rejects.toThrow('Middleware error');
      expect(finalHandler).not.toHaveBeenCalled();
    });

    it('should execute final handler when no middleware', async () => {
      const chain = new ToolMiddlewareChain();
      const finalHandler = vi.fn(async () => 'result');

      const result = await chain.execute(context, finalHandler);

      expect(result).toBe('result');
      expect(finalHandler).toHaveBeenCalled();
    });
  });

  describe('createTimingMiddleware', () => {
    it('should log execution time', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const middleware = createTimingMiddleware();

      const finalHandler = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'result';
      });

      const result = await middleware(context, finalHandler);

      expect(result).toBe('result');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Tool test-tool executed in \d+ms/),
      );

      consoleSpy.mockRestore();
    });

    it('should log execution time on error', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const middleware = createTimingMiddleware();

      const finalHandler = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error('Handler error');
      });

      await expect(middleware(context, finalHandler)).rejects.toThrow('Handler error');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Tool test-tool failed after \d+ms/),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('createLoggingMiddleware', () => {
    it('should log execution start and completion', async () => {
      const logger = vi.fn();
      const middleware = createLoggingMiddleware(logger);

      const finalHandler = vi.fn(async () => 'result');

      const result = await middleware(context, finalHandler);

      expect(result).toBe('result');
      expect(logger).toHaveBeenCalledWith('info', 'Executing tool: test-tool', {
        args: { input: 'test' },
        timestamp: context.timestamp,
        requestId: 'req_123',
      });
      expect(logger).toHaveBeenCalledWith('info', 'Tool test-tool completed successfully');
    });

    it('should log errors', async () => {
      const logger = vi.fn();
      const middleware = createLoggingMiddleware(logger);

      const finalHandler = vi.fn(async () => {
        throw new Error('Handler error');
      });

      await expect(middleware(context, finalHandler)).rejects.toThrow('Handler error');
      expect(logger).toHaveBeenCalledWith('error', 'Tool test-tool failed', {
        error: 'Handler error',
      });
    });
  });

  describe('createTimeoutMiddleware', () => {
    it('should allow execution within timeout', async () => {
      const middleware = createTimeoutMiddleware(100);

      const finalHandler = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'result';
      });

      const result = await middleware(context, finalHandler);
      expect(result).toBe('result');
    });

    it('should timeout long-running executions', async () => {
      const middleware = createTimeoutMiddleware(50);

      const finalHandler = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'result';
      });

      await expect(middleware(context, finalHandler)).rejects.toThrow(
        'Tool test-tool timed out after 50ms',
      );
    });
  });

  describe('createRateLimitMiddleware', () => {
    it('should allow calls within rate limit', async () => {
      const middleware = createRateLimitMiddleware(3, 1000);
      const finalHandler = vi.fn(async () => 'result');

      // First three calls should succeed
      for (let i = 0; i < 3; i++) {
        const result = await middleware(context, finalHandler);
        expect(result).toBe('result');
      }
    });

    it('should block calls exceeding rate limit', async () => {
      const middleware = createRateLimitMiddleware(2, 1000);
      const finalHandler = vi.fn(async () => 'result');

      // First two calls should succeed
      await middleware(context, finalHandler);
      await middleware(context, finalHandler);

      // Third call should be blocked
      await expect(middleware(context, finalHandler)).rejects.toThrow(
        'Rate limit exceeded for tool test-tool. Max 2 calls per 1000ms',
      );
    });

    it('should reset rate limit after window expires', async () => {
      const middleware = createRateLimitMiddleware(1, 10); // 10ms window
      const finalHandler = vi.fn(async () => 'result');

      // First call should succeed
      await middleware(context, finalHandler);

      // Second call should be blocked
      await expect(middleware(context, finalHandler)).rejects.toThrow('Rate limit exceeded');

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 15));

      // Third call should succeed after reset
      const result = await middleware(context, finalHandler);
      expect(result).toBe('result');
    });
  });

  describe('createSecurityMiddleware', () => {
    it('should allow tools in allowlist', async () => {
      const allowedTools = new Set(['test-tool', 'other-tool']);
      const middleware = createSecurityMiddleware(allowedTools);
      const finalHandler = vi.fn(async () => 'result');

      const result = await middleware(context, finalHandler);
      expect(result).toBe('result');
    });

    it('should block tools not in allowlist', async () => {
      const allowedTools = new Set(['other-tool']);
      const middleware = createSecurityMiddleware(allowedTools);
      const finalHandler = vi.fn(async () => 'result');

      await expect(middleware(context, finalHandler)).rejects.toThrow(
        'Tool test-tool is not in the allowed tools list',
      );
    });

    it('should block dangerous tools', async () => {
      const allowedTools = new Set(['test-tool']);
      const dangerousTools = new Set(['test-tool']);
      const middleware = createSecurityMiddleware(allowedTools, dangerousTools);
      const finalHandler = vi.fn(async () => 'result');

      await expect(middleware(context, finalHandler)).rejects.toThrow(
        'Tool test-tool is blocked for security reasons',
      );
    });

    it('should allow all tools when no restrictions', async () => {
      const middleware = createSecurityMiddleware();
      const finalHandler = vi.fn(async () => 'result');

      const result = await middleware(context, finalHandler);
      expect(result).toBe('result');
    });
  });
});
