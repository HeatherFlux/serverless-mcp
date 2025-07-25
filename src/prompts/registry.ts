import type { McpPrompt } from '../core/types.js';
import type { PromptDefinition, PromptRegistry } from './types.js';

export class DefaultPromptRegistry implements PromptRegistry {
  private prompts = new Map<string, PromptDefinition>();

  register(prompt: PromptDefinition): void {
    this.prompts.set(prompt.name, prompt);
  }

  unregister(name: string): void {
    this.prompts.delete(name);
  }

  list(): McpPrompt[] {
    return Array.from(this.prompts.values()).map((prompt) => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments,
    }));
  }

  get(name: string): PromptDefinition | undefined {
    return this.prompts.get(name);
  }

  has(name: string): boolean {
    return this.prompts.has(name);
  }

  clear(): void {
    this.prompts.clear();
  }

  size(): number {
    return this.prompts.size;
  }

  names(): string[] {
    return Array.from(this.prompts.keys());
  }
}
