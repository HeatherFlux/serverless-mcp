import type { McpTool } from '../core/types.js';
import type { ToolDefinition, ToolRegistry } from './types.js';

export class DefaultToolRegistry implements ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  list(): McpTool[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  clear(): void {
    this.tools.clear();
  }

  size(): number {
    return this.tools.size;
  }

  names(): string[] {
    return Array.from(this.tools.keys());
  }

  // Get tools by category or filter
  getByFilter(predicate: (tool: ToolDefinition) => boolean): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(predicate);
  }
}
