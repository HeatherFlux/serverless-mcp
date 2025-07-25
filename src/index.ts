// Core exports
export * from './core/index.js';

// Slice exports
export * from './prompts/index.js';
export * from './resources/index.js';
export * from './tools/index.js';
export * from './roots/index.js';

// Transport exports (avoiding re-export conflict)
export {
  StdioTransport,
  HttpStreamingTransport,
  type StdioTransportOptions,
  type HttpTransportOptions,
  type TransportMetrics,
} from './transports/index.js';

// Lambda exports
export * from './lambda/index.js';

// Main server class re-export for convenience
export { McpServer } from './core/server.js';
