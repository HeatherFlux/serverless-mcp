# Serverless MCP

A modern TypeScript package implementing the Model Context Protocol (MCP) with modular architecture and AWS Lambda streaming support.

## Features

- 🎯 **Full MCP Protocol Support** - Complete implementation of MCP 2024-11-05 specification
- 🧩 **Modular Architecture** - Independent slices for prompts, resources, tools, and roots
- 🚀 **AWS Lambda Ready** - Built-in support for Lambda streaming responses
- 📡 **Multiple Transports** - stdio, HTTP streaming, and Lambda transports
- 🔧 **TypeScript First** - Full type safety with comprehensive schemas
- 🧪 **Well Tested** - Comprehensive test suite with high coverage
- ⚡ **High Performance** - Optimized for serverless and edge environments
- 🎨 **Decorator Support** - Optional decorators for clean API design

## Installation

```bash
npm install serverless-mcp
# or
pnpm add serverless-mcp
# or
yarn add serverless-mcp
```

## Quick Start

### Basic Server

```typescript
import {
  McpServer,
  StdioTransport,
  McpToolProvider,
  McpResourceProvider,
} from 'serverless-mcp';

// Create transport and server
const transport = new StdioTransport();
const server = new McpServer(transport, {
  name: 'my-mcp-server',
  version: '1.0.0',
});

// Setup tools
const toolProvider = new McpToolProvider();
toolProvider.registerTool({
  name: 'hello',
  description: 'Say hello',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Name to greet' }
    },
    required: ['name']
  },
  handler: async (args) => `Hello, ${args.name}!`
});

server.setToolProvider(toolProvider);
```

### AWS Lambda Server

```typescript
import { LambdaMcpHandler } from 'serverless-mcp';

export const handler = LambdaMcpHandler.create(
  {
    name: 'lambda-mcp-server',
    version: '1.0.0',
    transport: {
      cors: { origin: '*' },
      enableLogs: true,
    },
  },
  (server) => {
    // Configure your server here
    const toolProvider = new McpToolProvider();
    // ... setup tools, resources, prompts
    server.setToolProvider(toolProvider);
  }
);
```

## Core Concepts

### Slices

The library is organized into modular slices, each handling a specific aspect of the MCP protocol:

- **Prompts** - Template messages and conversation patterns
- **Resources** - Data sources and content providers  
- **Tools** - Functions that can be executed by AI models
- **Roots** - File system and URI boundary definitions

### Transports

Multiple transport mechanisms are supported:

- **StdioTransport** - For subprocess communication
- **HttpStreamingTransport** - For HTTP with Server-Sent Events
- **LambdaStreamingTransport** - For AWS Lambda with response streaming

## API Reference

### Tools

```typescript
import { McpToolProvider } from 'serverless-mcp';

const toolProvider = new McpToolProvider();

// Simple tool
toolProvider.registerTool(
  McpToolProvider.createSimpleTool(
    'current-time',
    'Get current timestamp',
    () => new Date().toISOString()
  )
);

// Parameterized tool
toolProvider.registerTool(
  McpToolProvider.createParameterizedTool(
    'calculate',
    'Perform calculations',
    [
      { name: 'operation', type: 'string', required: true },
      { name: 'a', type: 'number', required: true },
      { name: 'b', type: 'number', required: true },
    ],
    async (args) => {
      // Tool implementation
    }
  )
);
```

### Resources

```typescript
import { McpResourceProvider } from 'serverless-mcp';

const resourceProvider = new McpResourceProvider();

// Static resource
resourceProvider.registerResource(
  McpResourceProvider.createStaticResource(
    'memory://config',
    'Configuration',
    JSON.stringify({ setting: 'value' }),
    'application/json'
  )
);

// Dynamic resource
resourceProvider.registerResource(
  McpResourceProvider.createDynamicResource(
    'memory://stats',
    'Live Statistics',
    () => JSON.stringify({ timestamp: Date.now() }),
    'application/json'
  )
);
```

### Prompts

```typescript
import { McpPromptProvider, PromptUtils } from 'serverless-mcp';

const promptProvider = new McpPromptProvider();

promptProvider.registerPrompt({
  name: 'greeting',
  description: 'Generate personalized greetings',
  arguments: [
    { name: 'name', required: true },
    { name: 'formal', required: false }
  ],
  handler: async (args) => {
    const greeting = args.formal 
      ? `Good day, ${args.name}`
      : `Hi ${args.name}!`;
    
    return [PromptUtils.createUserMessage(greeting)];
  }
});
```

### Middleware

Add middleware to tools for cross-cutting concerns:

```typescript
import { 
  createTimingMiddleware,
  createLoggingMiddleware,
  createTimeoutMiddleware,
  createRateLimitMiddleware,
} from 'serverless-mcp';

const toolProvider = new McpToolProvider();

toolProvider
  .use(createTimingMiddleware())
  .use(createLoggingMiddleware())
  .use(createTimeoutMiddleware(5000))
  .use(createRateLimitMiddleware(10, 60000)); // 10 calls per minute
```

## Examples

See the [examples](./examples) directory for complete working examples:

- [Basic Server](./examples/basic-server) - Complete stdio server with all features
- [Lambda Server](./examples/lambda-server) - AWS Lambda deployment example

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build the package
pnpm build

# Lint and format
pnpm lint
pnpm format
```

## Architecture

```
src/
├── core/           # Core JSON-RPC and MCP protocol
├── prompts/        # Prompt management and templates
├── resources/      # Resource providers and caching
├── tools/          # Tool execution and middleware
├── roots/          # Root directory management
├── transports/     # Transport implementations
└── lambda/         # AWS Lambda integration
```

Each slice is independently testable and can be used separately if needed.

## TypeScript Support

The library is built with TypeScript and provides comprehensive type definitions:

```typescript
import type {
  McpTool,
  McpResource,
  McpPrompt,
  JsonRpcMessage,
  ToolDefinition,
  ResourceDefinition,
  PromptDefinition,
} from 'serverless-mcp';
```

## License

MIT - see [LICENSE](./LICENSE) file for details.

## Contributing

Contributions are welcome! Please read our [contributing guidelines](./CONTRIBUTING.md) and submit pull requests to our repository.

## Support

- 📚 [Documentation](./docs)
- 🐛 [Issue Tracker](https://github.com/your-org/serverless-mcp/issues)
- 💬 [Discussions](https://github.com/your-org/serverless-mcp/discussions)