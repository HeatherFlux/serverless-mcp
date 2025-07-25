import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpToolProvider } from './provider.js';
import { DefaultToolRegistry } from './registry.js';
import { ToolExecutionError, InvalidParamsError } from '../core/errors.js';
import type { ToolDefinition } from './types.js';

describe('McpToolProvider', () => {
  let provider: McpToolProvider;

  beforeEach(() => {
    provider = new McpToolProvider();
  });

  describe('tool registration and listing', () => {
    it('should register and list tools', async () => {
      const toolDef: ToolDefinition = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'Test input' },
          },
          required: ['input'],
        },
        handler: async (args) => `Hello ${args.input}`,
      };

      provider.registerTool(toolDef);

      const tools = await provider.listTools();
      expect(tools).toHaveLength(1);
      expect(tools[0]).toMatchObject({
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'Test input' },
          },
          required: ['input'],
        },
      });
    });

    it('should reject invalid tool names', () => {
      const invalidTool: ToolDefinition = {
        name: '123-invalid',
        inputSchema: { type: 'object' },
        handler: async () => 'result',
      };

      expect(() => provider.registerTool(invalidTool)).toThrow('Invalid tool name');
    });

    it('should reject invalid input schemas', () => {
      const invalidTool: ToolDefinition = {
        name: 'valid-name',
        inputSchema: { type: 'string' }, // Should be object
        handler: async () => 'result',
      };

      expect(() => provider.registerTool(invalidTool)).toThrow('Invalid input schema');
    });
  });

  describe('tool execution', () => {
    beforeEach(() => {
      const simpleTool: ToolDefinition = {
        name: 'simple',
        description: 'A simple tool',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
        handler: async () => 'simple result',
      };

      const parameterizedTool: ToolDefinition = {
        name: 'echo',
        description: 'Echo the input',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Message to echo' },
            repeat: {
              type: 'integer',
              description: 'Number of times to repeat',
              minimum: 1,
              maximum: 5,
            },
          },
          required: ['message'],
        },
        handler: async (args) => {
          const message = args.message as string;
          const repeat = (args.repeat as number) || 1;
          return Array(repeat).fill(message).join(' ');
        },
      };

      const errorTool: ToolDefinition = {
        name: 'error',
        description: 'A tool that throws an error',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
        handler: async () => {
          throw new Error('Tool error');
        },
      };

      provider.registerTool(simpleTool);
      provider.registerTool(parameterizedTool);
      provider.registerTool(errorTool);
    });

    it('should execute simple tools', async () => {
      const result = await provider.callTool('simple', {});
      expect(result).toBe('simple result');
    });

    it('should execute parameterized tools', async () => {
      const result = await provider.callTool('echo', {
        message: 'Hello',
        repeat: 3,
      });
      expect(result).toBe('Hello Hello Hello');
    });

    it('should use default values for optional parameters', async () => {
      const result = await provider.callTool('echo', {
        message: 'Hello',
      });
      expect(result).toBe('Hello');
    });

    it('should throw error for non-existent tools', async () => {
      await expect(provider.callTool('non-existent', {})).rejects.toThrow(ToolExecutionError);
    });

    it('should validate required parameters', async () => {
      await expect(provider.callTool('echo', { repeat: 2 })).rejects.toThrow(InvalidParamsError);
    });

    it('should validate parameter types', async () => {
      await expect(
        provider.callTool('echo', { message: 'Hello', repeat: 'invalid' }),
      ).rejects.toThrow(InvalidParamsError);
    });

    it('should validate parameter constraints', async () => {
      await expect(provider.callTool('echo', { message: 'Hello', repeat: 10 })).rejects.toThrow(
        InvalidParamsError,
      );
    });

    it('should handle tool execution errors', async () => {
      await expect(provider.callTool('error', {})).rejects.toThrow(ToolExecutionError);
    });

    it('should sanitize arguments', async () => {
      const result = await provider.callTool('echo', {
        message: '  Hello World  ',
        repeat: 1,
      });
      expect(result).toBe('Hello World');
    });
  });

  describe('middleware integration', () => {
    it('should execute middleware in order', async () => {
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

      provider.use(middleware1).use(middleware2);

      const tool: ToolDefinition = {
        name: 'test',
        inputSchema: { type: 'object' },
        handler: async () => {
          executionOrder.push('handler');
          return 'result';
        },
      };

      provider.registerTool(tool);

      const result = await provider.callTool('test', {});

      expect(result).toBe('result');
      expect(executionOrder).toEqual([
        'middleware1-before',
        'middleware2-before',
        'handler',
        'middleware2-after',
        'middleware1-after',
      ]);
    });

    it('should handle middleware errors', async () => {
      const errorMiddleware = vi.fn(async () => {
        throw new Error('Middleware error');
      });

      provider.use(errorMiddleware);

      const tool: ToolDefinition = {
        name: 'test',
        inputSchema: { type: 'object' },
        handler: async () => 'result',
      };

      provider.registerTool(tool);

      await expect(provider.callTool('test', {})).rejects.toThrow(ToolExecutionError);
    });
  });

  describe('tool management', () => {
    it('should check if tools exist', () => {
      const tool: ToolDefinition = {
        name: 'test',
        inputSchema: { type: 'object' },
        handler: async () => 'result',
      };

      expect(provider.hasTool('test')).toBe(false);
      provider.registerTool(tool);
      expect(provider.hasTool('test')).toBe(true);
    });

    it('should unregister tools', async () => {
      const tool: ToolDefinition = {
        name: 'test',
        inputSchema: { type: 'object' },
        handler: async () => 'result',
      };

      provider.registerTool(tool);
      expect(provider.hasTool('test')).toBe(true);

      provider.unregisterTool('test');
      expect(provider.hasTool('test')).toBe(false);

      const tools = await provider.listTools();
      expect(tools).toHaveLength(0);
    });

    it('should clear all tools', async () => {
      const tool1: ToolDefinition = {
        name: 'test1',
        inputSchema: { type: 'object' },
        handler: async () => 'result1',
      };
      const tool2: ToolDefinition = {
        name: 'test2',
        inputSchema: { type: 'object' },
        handler: async () => 'result2',
      };

      provider.registerTool(tool1);
      provider.registerTool(tool2);

      let tools = await provider.listTools();
      expect(tools).toHaveLength(2);

      provider.clear();

      tools = await provider.listTools();
      expect(tools).toHaveLength(0);
    });
  });

  describe('static factory methods', () => {
    it('should create simple tools', () => {
      const tool = McpToolProvider.createSimpleTool(
        'simple',
        'A simple tool',
        async () => 'result',
      );

      expect(tool.name).toBe('simple');
      expect(tool.description).toBe('A simple tool');
      expect(tool.inputSchema).toMatchObject({
        type: 'object',
        properties: {},
        required: [],
      });
    });

    it('should create parameterized tools', () => {
      const tool = McpToolProvider.createParameterizedTool(
        'parameterized',
        'A parameterized tool',
        [
          { name: 'input', type: 'string', description: 'Input string', required: true },
          { name: 'count', type: 'integer', description: 'Count', required: false, default: 1 },
        ],
        async (args) => `${args.input} x ${args.count}`,
      );

      expect(tool.name).toBe('parameterized');
      expect(tool.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Input string' },
          count: { type: 'integer', description: 'Count', default: 1 },
        },
        required: ['input'],
      });
    });

    it('should create async tools', () => {
      const tool = McpToolProvider.createAsyncTool(
        'async',
        'An async tool',
        async () => 'async result',
      );

      expect(tool.name).toBe('async');
      expect(tool.description).toBe('An async tool');
      expect(typeof tool.handler).toBe('function');
    });
  });
});
