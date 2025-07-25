import { describe, it, expect, beforeEach } from 'vitest';
import { McpPromptProvider, PromptUtils } from './provider.js';
import { DefaultPromptRegistry } from './registry.js';
import { PromptNotFoundError, InvalidParamsError } from '../core/errors.js';
import type { PromptDefinition } from './types.js';

describe('McpPromptProvider', () => {
  let provider: McpPromptProvider;

  beforeEach(() => {
    provider = new McpPromptProvider();
  });

  describe('prompt registration and listing', () => {
    it('should register and list prompts', async () => {
      const promptDef: PromptDefinition = {
        name: 'test-prompt',
        description: 'A test prompt',
        arguments: [{ name: 'input', description: 'Test input', required: true }],
        handler: async (args) => [PromptUtils.createUserMessage(`Hello ${args.input}`)],
      };

      provider.registerPrompt(promptDef);

      const prompts = await provider.listPrompts();
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toMatchObject({
        name: 'test-prompt',
        description: 'A test prompt',
        arguments: [{ name: 'input', description: 'Test input', required: true }],
      });
    });

    it('should reject invalid prompt names', () => {
      const invalidPrompt: PromptDefinition = {
        name: '123-invalid',
        handler: async () => [],
      };

      expect(() => provider.registerPrompt(invalidPrompt)).toThrow('Invalid prompt name');
    });
  });

  describe('prompt execution', () => {
    beforeEach(() => {
      const simplePrompt: PromptDefinition = {
        name: 'simple',
        description: 'A simple prompt',
        handler: async () => [PromptUtils.createUserMessage('Hello World')],
      };

      const parameterizedPrompt: PromptDefinition = {
        name: 'parameterized',
        description: 'A prompt with parameters',
        arguments: [
          { name: 'name', description: 'Name parameter', required: true },
          { name: 'greeting', description: 'Greeting type', required: false },
        ],
        handler: async (args) => {
          const name = args.name as string;
          const greeting = (args.greeting as string) || 'Hello';
          return [PromptUtils.createUserMessage(`${greeting} ${name}`)];
        },
      };

      provider.registerPrompt(simplePrompt);
      provider.registerPrompt(parameterizedPrompt);
    });

    it('should execute simple prompts', async () => {
      const messages = await provider.getPrompt('simple');

      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        role: 'user',
        content: {
          type: 'text',
          text: 'Hello World',
        },
      });
    });

    it('should execute parameterized prompts', async () => {
      const messages = await provider.getPrompt('parameterized', {
        name: 'Alice',
        greeting: 'Hi',
      });

      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        role: 'user',
        content: {
          type: 'text',
          text: 'Hi Alice',
        },
      });
    });

    it('should use default values for optional parameters', async () => {
      const messages = await provider.getPrompt('parameterized', {
        name: 'Bob',
      });

      expect(messages[0].content.text).toBe('Hello Bob');
    });

    it('should throw error for non-existent prompts', async () => {
      await expect(provider.getPrompt('non-existent')).rejects.toThrow(PromptNotFoundError);
    });

    it('should validate required parameters', async () => {
      await expect(provider.getPrompt('parameterized', { greeting: 'Hi' })).rejects.toThrow(
        InvalidParamsError,
      );
    });

    it('should reject unexpected parameters', async () => {
      await expect(
        provider.getPrompt('parameterized', {
          name: 'Alice',
          unexpected: 'value',
        }),
      ).rejects.toThrow(InvalidParamsError);
    });
  });

  describe('prompt management', () => {
    it('should check if prompts exist', () => {
      const promptDef: PromptDefinition = {
        name: 'test',
        handler: async () => [],
      };

      expect(provider.hasPrompt('test')).toBe(false);
      provider.registerPrompt(promptDef);
      expect(provider.hasPrompt('test')).toBe(true);
    });

    it('should unregister prompts', async () => {
      const promptDef: PromptDefinition = {
        name: 'test',
        handler: async () => [],
      };

      provider.registerPrompt(promptDef);
      expect(provider.hasPrompt('test')).toBe(true);

      provider.unregisterPrompt('test');
      expect(provider.hasPrompt('test')).toBe(false);

      const prompts = await provider.listPrompts();
      expect(prompts).toHaveLength(0);
    });

    it('should clear all prompts', async () => {
      const prompt1: PromptDefinition = {
        name: 'test1',
        handler: async () => [],
      };
      const prompt2: PromptDefinition = {
        name: 'test2',
        handler: async () => [],
      };

      provider.registerPrompt(prompt1);
      provider.registerPrompt(prompt2);

      let prompts = await provider.listPrompts();
      expect(prompts).toHaveLength(2);

      provider.clear();

      prompts = await provider.listPrompts();
      expect(prompts).toHaveLength(0);
    });
  });
});

describe('PromptUtils', () => {
  describe('message creation', () => {
    it('should create user messages', () => {
      const message = PromptUtils.createUserMessage('Test message');

      expect(message).toMatchObject({
        role: 'user',
        content: {
          type: 'text',
          text: 'Test message',
        },
      });
    });

    it('should create assistant messages', () => {
      const message = PromptUtils.createAssistantMessage('Response message');

      expect(message).toMatchObject({
        role: 'assistant',
        content: {
          type: 'text',
          text: 'Response message',
        },
      });
    });

    it('should create conversations', () => {
      const conversation = PromptUtils.createConversation([
        { role: 'user', text: 'Hello' },
        { role: 'assistant', text: 'Hi there!' },
        { role: 'user', text: 'How are you?' },
      ]);

      expect(conversation).toHaveLength(3);
      expect(conversation[0]).toMatchObject({
        role: 'user',
        content: { type: 'text', text: 'Hello' },
      });
      expect(conversation[1]).toMatchObject({
        role: 'assistant',
        content: { type: 'text', text: 'Hi there!' },
      });
      expect(conversation[2]).toMatchObject({
        role: 'user',
        content: { type: 'text', text: 'How are you?' },
      });
    });
  });

  describe('template interpolation', () => {
    it('should interpolate simple templates', () => {
      const template = 'Hello {{name}}, welcome to {{place}}!';
      const result = PromptUtils.interpolateTemplate(template, {
        name: 'Alice',
        place: 'Wonderland',
      });

      expect(result).toBe('Hello Alice, welcome to Wonderland!');
    });

    it('should handle missing variables', () => {
      const template = 'Hello {{name}}, welcome to {{missing}}!';
      const result = PromptUtils.interpolateTemplate(template, {
        name: 'Alice',
      });

      expect(result).toBe('Hello Alice, welcome to {{missing}}!');
    });

    it('should handle various value types', () => {
      const template = 'Number: {{num}}, Boolean: {{bool}}, Null: {{null}}';
      const result = PromptUtils.interpolateTemplate(template, {
        num: 42,
        bool: true,
        null: null,
      });

      expect(result).toBe('Number: 42, Boolean: true, Null: null');
    });
  });
});
