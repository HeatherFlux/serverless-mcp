import {
  McpServer,
  StdioTransport,
  McpPromptProvider,
  McpResourceProvider,
  McpToolProvider,
  McpRootProvider,
  PromptUtils,
  createTimingMiddleware,
  createLoggingMiddleware,
} from 'serverless-mcp';

async function main() {
  // Create transport (stdio for this example)
  const transport = new StdioTransport();

  // Create server
  const server = new McpServer(transport, {
    name: 'basic-example-server',
    version: '1.0.0',
    capabilities: {
      logging: {},
      prompts: { listChanged: true },
      resources: { subscribe: true, listChanged: true },
      tools: { listChanged: true },
      roots: { listChanged: true },
    },
    instructions: 'A basic MCP server example with tools, resources, prompts, and roots.',
  });

  // Setup prompt provider
  const promptProvider = new McpPromptProvider();

  // Register some example prompts
  promptProvider.registerPrompt({
    name: 'greeting',
    description: 'Generate a greeting message',
    arguments: [
      { name: 'name', description: 'Name to greet', required: true },
      { name: 'formal', description: 'Use formal greeting', required: false },
    ],
    handler: async (args) => {
      const name = args.name as string;
      const formal = args.formal as boolean;
      const greeting = formal ? `Good day, ${name}` : `Hello ${name}!`;
      
      return [PromptUtils.createUserMessage(greeting)];
    },
  });

  promptProvider.registerPrompt({
    name: 'conversation-starter',
    description: 'Generate a conversation starter',
    arguments: [
      { name: 'topic', description: 'Topic for conversation', required: false },
    ],
    handler: async (args) => {
      const topic = args.topic as string || 'general';
      const starters = {
        general: "What's the most interesting thing you've learned recently?",
        tech: "What's your favorite programming language and why?",
        science: "What scientific discovery do you think will change the world?",
        business: "What's the biggest challenge facing businesses today?",
      };

      const starter = starters[topic as keyof typeof starters] || starters.general;
      
      return PromptUtils.createConversation([
        { role: 'user', text: starter },
        { role: 'assistant', text: "I'd be happy to discuss that with you!" },
      ]);
    },
  });

  server.setPromptProvider(promptProvider);

  // Setup resource provider
  const resourceProvider = new McpResourceProvider();

  // Register some example resources
  resourceProvider.registerResource(
    McpResourceProvider.createStaticResource(
      'memory://server-info',
      'Server Information',
      JSON.stringify({
        name: 'basic-example-server',
        version: '1.0.0',
        uptime: Date.now(),
        features: ['prompts', 'resources', 'tools', 'roots'],
      }, null, 2),
      'application/json',
      'Information about this MCP server',
    ),
  );

  resourceProvider.registerResource(
    McpResourceProvider.createDynamicResource(
      'memory://current-time',
      'Current Time',
      () => new Date().toISOString(),
      'text/plain',
      'Current server time in ISO format',
    ),
  );

  resourceProvider.registerResource(
    McpResourceProvider.createStaticResource(
      'memory://example-config',
      'Example Configuration',
      JSON.stringify({
        environment: 'development',
        debug: true,
        features: {
          logging: true,
          metrics: false,
        },
      }, null, 2),
      'application/json',
      'Example configuration file',
    ),
  );

  server.setResourceProvider(resourceProvider);

  // Setup tool provider
  const toolProvider = new McpToolProvider();

  // Add middleware for timing and logging
  toolProvider
    .use(createTimingMiddleware())
    .use(createLoggingMiddleware());

  // Register some example tools
  toolProvider.registerTool(
    McpToolProvider.createParameterizedTool(
      'calculate',
      'Perform basic arithmetic calculations',
      [
        { name: 'operation', type: 'string', description: 'Operation to perform (add, subtract, multiply, divide)', required: true },
        { name: 'a', type: 'number', description: 'First number', required: true },
        { name: 'b', type: 'number', description: 'Second number', required: true },
      ],
      async (args) => {
        const operation = args.operation as string;
        const a = args.a as number;
        const b = args.b as number;

        switch (operation.toLowerCase()) {
          case 'add':
            return { result: a + b, operation: `${a} + ${b}` };
          case 'subtract':
            return { result: a - b, operation: `${a} - ${b}` };
          case 'multiply':
            return { result: a * b, operation: `${a} × ${b}` };
          case 'divide':
            if (b === 0) throw new Error('Division by zero');
            return { result: a / b, operation: `${a} ÷ ${b}` };
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
      },
    ),
  );

  toolProvider.registerTool(
    McpToolProvider.createSimpleTool(
      'random-number',
      'Generate a random number',
      async () => {
        return {
          number: Math.random(),
          timestamp: new Date().toISOString(),
        };
      },
      {
        type: 'object',
        properties: {
          min: { type: 'number', description: 'Minimum value', default: 0 },
          max: { type: 'number', description: 'Maximum value', default: 1 },
        },
        required: [],
      },
    ),
  );

  toolProvider.registerTool(
    McpToolProvider.createAsyncTool(
      'echo',
      'Echo back the provided message',
      async (args) => {
        const message = args.message as string || 'Hello World';
        const delay = args.delay as number || 0;
        
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        return {
          echo: message,
          timestamp: new Date().toISOString(),
          delay: delay,
        };
      },
      {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Message to echo back' },
          delay: { type: 'number', description: 'Delay in milliseconds', minimum: 0, maximum: 5000 },
        },
        required: [],
      },
    ),
  );

  server.setToolProvider(toolProvider);

  // Setup root provider
  const rootProvider = new McpRootProvider();

  // Register some example roots
  rootProvider.registerRoot(
    McpRootProvider.createMemoryRoot(
      'examples',
      'Example Data',
      {
        recursive: true,
        includeHidden: false,
        filters: {
          include: ['*.json', '*.txt'],
          exclude: ['temp/*'],
        },
      },
    ),
  );

  rootProvider.registerRoot(
    McpRootProvider.createMemoryRoot(
      'configs',
      'Configuration Files',
      {
        recursive: false,
        includeHidden: true,
      },
    ),
  );

  server.setRootProvider(rootProvider);

  // Log server startup
  console.error('MCP Basic Example Server starting...');
  console.error(`Server: ${server}`);
  console.error(`Transport: ${transport.constructor.name}`);
  console.error(`Prompts: ${(await promptProvider.listPrompts()).length}`);
  console.error(`Resources: ${(await resourceProvider.listResources()).length}`);
  console.error(`Tools: ${(await toolProvider.listTools()).length}`);
  console.error(`Roots: ${(await rootProvider.listRoots()).length}`);
  console.error('Server ready for connections!');

  // Handle cleanup
  process.on('SIGINT', async () => {
    console.error('Shutting down gracefully...');
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('Shutting down gracefully...');
    await server.close();
    process.exit(0);
  });
}

// Start the server
main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});