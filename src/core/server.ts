import type {
  McpResource,
  McpResourceContents,
  McpTool,
  McpPrompt,
  McpPromptMessage,
  McpRoot,
  McpLogLevel,
} from './types.js';
import { McpProtocol, type Transport, type McpServerOptions } from './protocol.js';
import {
  InvalidParamsError,
  ResourceNotFoundError,
  ToolExecutionError,
  PromptNotFoundError,
} from './errors.js';

export interface ResourceProvider {
  listResources(): Promise<McpResource[]>;
  readResource(uri: string): Promise<McpResourceContents>;
  subscribeToResource?(uri: string): Promise<void>;
  unsubscribeFromResource?(uri: string): Promise<void>;
}

export interface ToolProvider {
  listTools(): Promise<McpTool[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
}

export interface PromptProvider {
  listPrompts(): Promise<McpPrompt[]>;
  getPrompt(name: string, args?: Record<string, unknown>): Promise<McpPromptMessage[]>;
}

export interface RootProvider {
  listRoots(): Promise<McpRoot[]>;
}

export interface LoggingProvider {
  setLogLevel(level: McpLogLevel): Promise<void>;
}

export interface SamplingProvider {
  createMessage(
    messages: Array<{ role: 'user' | 'assistant'; content: { type: 'text'; text: string } }>,
    modelPreferences?: {
      hints?: {
        name?: string;
      };
      costPriority?: number;
      speedPriority?: number;
      intelligencePriority?: number;
    },
    systemPrompt?: string,
    includeContext?: 'none' | 'thisServer' | 'allServers',
    temperature?: number,
    maxTokens?: number,
    stopSequences?: string[],
    metadata?: Record<string, unknown>,
  ): Promise<{ role: 'assistant'; content: { type: 'text'; text: string } }>;
}

export class McpServer {
  private protocol: McpProtocol;
  private resourceProvider?: ResourceProvider;
  private toolProvider?: ToolProvider;
  private promptProvider?: PromptProvider;
  private rootProvider?: RootProvider;
  private loggingProvider?: LoggingProvider;
  private samplingProvider?: SamplingProvider;

  constructor(transport: Transport, options: McpServerOptions) {
    this.protocol = new McpProtocol(transport, options);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Resource handlers
    this.protocol.onRequest('resources/list', this.handleListResources.bind(this));
    this.protocol.onRequest('resources/read', this.handleReadResource.bind(this));
    this.protocol.onRequest('resources/subscribe', this.handleSubscribeResource.bind(this));
    this.protocol.onRequest('resources/unsubscribe', this.handleUnsubscribeResource.bind(this));

    // Tool handlers
    this.protocol.onRequest('tools/list', this.handleListTools.bind(this));
    this.protocol.onRequest('tools/call', this.handleCallTool.bind(this));

    // Prompt handlers
    this.protocol.onRequest('prompts/list', this.handleListPrompts.bind(this));
    this.protocol.onRequest('prompts/get', this.handleGetPrompt.bind(this));

    // Root handlers
    this.protocol.onRequest('roots/list', this.handleListRoots.bind(this));

    // Logging handlers
    this.protocol.onRequest('logging/setLevel', this.handleSetLogLevel.bind(this));

    // Sampling handlers
    this.protocol.onRequest('sampling/createMessage', this.handleCreateMessage.bind(this));
  }

  // Resource methods
  setResourceProvider(provider: ResourceProvider): void {
    this.resourceProvider = provider;
  }

  private async handleListResources(): Promise<{ resources: McpResource[] }> {
    if (!this.resourceProvider) {
      return { resources: [] };
    }

    const resources = await this.resourceProvider.listResources();
    return { resources };
  }

  private async handleReadResource(params: unknown): Promise<{ contents: McpResourceContents[] }> {
    if (!this.resourceProvider) {
      throw new ResourceNotFoundError('No resource provider configured');
    }

    if (!params || typeof params !== 'object' || !('uri' in params)) {
      throw new InvalidParamsError('Missing required parameter: uri');
    }

    const { uri } = params as { uri: string };
    const contents = await this.resourceProvider.readResource(uri);
    return { contents: [contents] };
  }

  private async handleSubscribeResource(params: unknown): Promise<void> {
    if (!this.resourceProvider?.subscribeToResource) {
      throw new InvalidParamsError('Resource subscription not supported');
    }

    if (!params || typeof params !== 'object' || !('uri' in params)) {
      throw new InvalidParamsError('Missing required parameter: uri');
    }

    const { uri } = params as { uri: string };
    await this.resourceProvider.subscribeToResource(uri);
  }

  private async handleUnsubscribeResource(params: unknown): Promise<void> {
    if (!this.resourceProvider?.unsubscribeFromResource) {
      throw new InvalidParamsError('Resource unsubscription not supported');
    }

    if (!params || typeof params !== 'object' || !('uri' in params)) {
      throw new InvalidParamsError('Missing required parameter: uri');
    }

    const { uri } = params as { uri: string };
    await this.resourceProvider.unsubscribeFromResource(uri);
  }

  async notifyResourceChanged(uri: string): Promise<void> {
    await this.protocol.sendNotification('notifications/resources/updated', { uri });
  }

  async notifyResourceListChanged(): Promise<void> {
    await this.protocol.sendNotification('notifications/resources/list_changed');
  }

  // Tool methods
  setToolProvider(provider: ToolProvider): void {
    this.toolProvider = provider;
  }

  private async handleListTools(): Promise<{ tools: McpTool[] }> {
    if (!this.toolProvider) {
      return { tools: [] };
    }

    const tools = await this.toolProvider.listTools();
    return { tools };
  }

  private async handleCallTool(
    params: unknown,
  ): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    if (!this.toolProvider) {
      throw new ToolExecutionError('unknown', 'No tool provider configured');
    }

    if (!params || typeof params !== 'object' || !('name' in params)) {
      throw new InvalidParamsError('Missing required parameter: name');
    }

    const { name, arguments: args = {} } = params as {
      name: string;
      arguments?: Record<string, unknown>;
    };

    try {
      const result = await this.toolProvider.callTool(name, args);
      const resultText = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

      return {
        content: [
          {
            type: 'text',
            text: resultText,
          },
        ],
      };
    } catch (error) {
      throw new ToolExecutionError(name, error instanceof Error ? error.message : String(error));
    }
  }

  async notifyToolListChanged(): Promise<void> {
    await this.protocol.sendNotification('notifications/tools/list_changed');
  }

  // Prompt methods
  setPromptProvider(provider: PromptProvider): void {
    this.promptProvider = provider;
  }

  private async handleListPrompts(): Promise<{ prompts: McpPrompt[] }> {
    if (!this.promptProvider) {
      return { prompts: [] };
    }

    const prompts = await this.promptProvider.listPrompts();
    return { prompts };
  }

  private async handleGetPrompt(params: unknown): Promise<{ messages: McpPromptMessage[] }> {
    if (!this.promptProvider) {
      throw new PromptNotFoundError('No prompt provider configured');
    }

    if (!params || typeof params !== 'object' || !('name' in params)) {
      throw new InvalidParamsError('Missing required parameter: name');
    }

    const { name, arguments: args } = params as {
      name: string;
      arguments?: Record<string, unknown>;
    };
    const messages = await this.promptProvider.getPrompt(name, args);
    return { messages };
  }

  async notifyPromptListChanged(): Promise<void> {
    await this.protocol.sendNotification('notifications/prompts/list_changed');
  }

  // Root methods
  setRootProvider(provider: RootProvider): void {
    this.rootProvider = provider;
  }

  private async handleListRoots(): Promise<{ roots: McpRoot[] }> {
    if (!this.rootProvider) {
      return { roots: [] };
    }

    const roots = await this.rootProvider.listRoots();
    return { roots };
  }

  async notifyRootListChanged(): Promise<void> {
    await this.protocol.sendNotification('notifications/roots/list_changed');
  }

  // Logging methods
  setLoggingProvider(provider: LoggingProvider): void {
    this.loggingProvider = provider;
  }

  private async handleSetLogLevel(params: unknown): Promise<void> {
    if (!this.loggingProvider) {
      throw new InvalidParamsError('Logging not supported');
    }

    if (!params || typeof params !== 'object' || !('level' in params)) {
      throw new InvalidParamsError('Missing required parameter: level');
    }

    const { level } = params as { level: McpLogLevel };
    await this.loggingProvider.setLogLevel(level);
  }

  async sendLog(level: McpLogLevel, data: unknown, logger?: string): Promise<void> {
    await this.protocol.sendNotification('notifications/message', {
      level,
      data,
      ...(logger && { logger }),
    });
  }

  // Sampling methods
  setSamplingProvider(provider: SamplingProvider): void {
    this.samplingProvider = provider;
  }

  private async handleCreateMessage(
    params: unknown,
  ): Promise<{ role: 'assistant'; content: { type: 'text'; text: string } }> {
    if (!this.samplingProvider) {
      throw new InvalidParamsError('Sampling not supported');
    }

    if (!params || typeof params !== 'object' || !('messages' in params)) {
      throw new InvalidParamsError('Missing required parameter: messages');
    }

    const {
      messages,
      modelPreferences,
      systemPrompt,
      includeContext,
      temperature,
      maxTokens,
      stopSequences,
      metadata,
    } = params as {
      messages: Array<{ role: 'user' | 'assistant'; content: { type: 'text'; text: string } }>;
      modelPreferences?: {
        hints?: { name?: string };
        costPriority?: number;
        speedPriority?: number;
        intelligencePriority?: number;
      };
      systemPrompt?: string;
      includeContext?: 'none' | 'thisServer' | 'allServers';
      temperature?: number;
      maxTokens?: number;
      stopSequences?: string[];
      metadata?: Record<string, unknown>;
    };

    return await this.samplingProvider.createMessage(
      messages,
      modelPreferences,
      systemPrompt,
      includeContext,
      temperature,
      maxTokens,
      stopSequences,
      metadata,
    );
  }

  async close(): Promise<void> {
    await this.protocol.close();
  }
}
