import { describe, expect, it } from 'vitest';
import { PromptHandler, getPromptMetadata } from './decorators.js';

describe('Prompt Decorators', () => {
  describe('metadata management', () => {
    it('should create metadata if not exists', () => {
      class EmptyHandler {}
      const metadata = getPromptMetadata(EmptyHandler);
      expect(metadata.prompts.size).toBe(0);
    });

    it('should provide base handler functionality', () => {
      class TestHandler extends PromptHandler {
        getTestPrompts() {
          return this.getPrompts();
        }
      }

      const handler = new TestHandler();
      expect(handler.getTestPrompts()).toEqual([]);
      expect(handler.getPrompt('non-existent')).toBeUndefined();
      expect(handler.hasPrompt('non-existent')).toBe(false);
    });
  });
});
