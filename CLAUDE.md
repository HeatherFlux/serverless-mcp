# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
- `pnpm dev` - Watch mode for development with tsx
- `pnpm test:watch` - Run tests in watch mode with vitest

### Testing
- `pnpm test` - Run full test suite (vitest + typecheck + lint)
- `pnpm test:coverage` - Run tests with coverage report
- `vitest run src/tools/provider.test.ts` - Run specific test file
- `vitest run -t "test name"` - Run specific test by name

### Building
- `pnpm build:all` - Build complete package (types + ESM)
- `pnpm build:types` - Generate TypeScript declarations only
- `pnpm build:esm` - Build ESM modules only
- `pnpm clean` - Remove dist directory

### Code Quality
- `pnpm lint` - Run Biome linter
- `pnpm lint:fix` - Auto-fix linting issues
- `pnpm format` - Format code with Biome
- `pnpm typecheck` - Run TypeScript type checking

## Architecture Overview

This is a TypeScript implementation of the Model Context Protocol (MCP) with modular architecture optimized for serverless deployments, particularly AWS Lambda with streaming support.

### Core Structure

The codebase follows a **slice-based architecture** where each MCP capability is isolated in its own module:

- **core/** - JSON-RPC protocol implementation and main McpServer orchestrator
- **prompts/** - Prompt template management with decorators and validation
- **resources/** - Resource providers with caching support
- **tools/** - Tool execution with middleware pipeline (timing, logging, rate limiting)
- **roots/** - File system boundary management
- **transports/** - Multiple transport layers (stdio, HTTP streaming, Lambda)
- **lambda/** - AWS Lambda-specific handler with streaming response support

### Key Design Patterns

**Provider Pattern**: Each slice (tools, resources, prompts, roots) implements a provider interface that the McpServer consumes. Providers handle registration, validation, and execution of their respective capabilities.

**Middleware Pipeline**: The tools module supports middleware for cross-cutting concerns. Middleware functions wrap tool execution to add functionality like timing, logging, timeout, and rate limiting.

**Transport Abstraction**: All transports implement a common Transport interface, allowing the McpServer to work with different communication mechanisms without changes to core logic.

**Decorator Support**: Optional decorators (`@McpTool`, `@McpPrompt`) enable clean, metadata-driven API design for tool and prompt definitions.

### Lambda Integration

The Lambda handler (`LambdaMcpHandler`) provides:
- Automatic server configuration
- Streaming response support via AWS Lambda response streaming
- CORS configuration
- Built-in error handling and logging

### Testing Strategy

- Unit tests colocated with source files (`*.test.ts`)
- Uses Vitest for testing with Node environment
- Test utilities in each module for creating test fixtures
- Coverage reporting with v8 provider

### Package Structure

This is a monorepo using pnpm workspaces:
- Root package: The main serverless-mcp library
- examples/basic-server: stdio transport example
- examples/lambda-server: AWS Lambda deployment example

All exports are ESM-only with multiple entry points defined in package.json exports field.