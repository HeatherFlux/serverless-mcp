import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpProtocol, type Transport } from './protocol.js';
import type { JsonRpcMessage, JsonRpcRequest, JsonRpcResponse } from './types.js';

class MockTransport implements Transport {
  private messageHandler?: (message: JsonRpcMessage) => void;
  public sentMessages: JsonRpcMessage[] = [];

  async send(message: JsonRpcMessage): Promise<void> {
    this.sentMessages.push(message);
  }

  onMessage(handler: (message: JsonRpcMessage) => void): void {
    this.messageHandler = handler;
  }

  simulateMessage(message: JsonRpcMessage): void {
    this.messageHandler?.(message);
  }

  async close(): Promise<void> {
    // Mock implementation
  }
}

describe('McpProtocol', () => {
  let transport: MockTransport;
  let protocol: McpProtocol;

  beforeEach(() => {
    transport = new MockTransport();
    protocol = new McpProtocol(transport, {
      name: 'test-server',
      version: '1.0.0',
    });
  });

  describe('initialization', () => {
    it('should handle initialize request correctly', async () => {
      const initRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
      };

      transport.simulateMessage(initRequest);

      // Wait for async handling
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(transport.sentMessages).toHaveLength(1);
      const response = transport.sentMessages[0] as JsonRpcResponse;
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result).toMatchObject({
        protocolVersion: '2024-11-05',
        serverInfo: {
          name: 'test-server',
          version: '1.0.0',
        },
        capabilities: {
          logging: {},
          prompts: { listChanged: true },
          resources: { subscribe: true, listChanged: true },
          tools: { listChanged: true },
          roots: { listChanged: true },
        },
      });
    });

    it('should handle invalid initialize params', async () => {
      const invalidRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          // Missing required fields
        },
      };

      transport.simulateMessage(invalidRequest);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(transport.sentMessages).toHaveLength(1);
      const response = transport.sentMessages[0] as JsonRpcResponse;
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32600); // Invalid Request
    });
  });

  describe('request handling', () => {
    it('should handle custom request handlers', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ success: true });
      protocol.onRequest('custom/method', mockHandler);

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'custom/method',
        params: { test: 'data' },
      };

      transport.simulateMessage(request);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockHandler).toHaveBeenCalledWith({ test: 'data' }, 2);
      expect(transport.sentMessages).toHaveLength(1);
      const response = transport.sentMessages[0] as JsonRpcResponse;
      expect(response.result).toEqual({ success: true });
    });

    it('should handle method not found', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 3,
        method: 'nonexistent/method',
      };

      transport.simulateMessage(request);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(transport.sentMessages).toHaveLength(1);
      const response = transport.sentMessages[0] as JsonRpcResponse;
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601); // Method not found
    });
  });

  describe('notification handling', () => {
    it('should handle notifications without response', async () => {
      const mockHandler = vi.fn();
      protocol.onNotification('test/notification', mockHandler);

      const notification = {
        jsonrpc: '2.0' as const,
        method: 'test/notification',
        params: { data: 'test' },
      };

      transport.simulateMessage(notification);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockHandler).toHaveBeenCalledWith({ data: 'test' });
      expect(transport.sentMessages).toHaveLength(0); // No response for notifications
    });
  });

  describe('sending messages', () => {
    it('should send requests and handle responses', async () => {
      const responsePromise = protocol.sendRequest('test/method', { param: 'value' });

      // Simulate response
      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      };

      transport.simulateMessage(response);

      const result = await responsePromise;
      expect(result).toEqual({ success: true });
    });

    it('should send notifications', async () => {
      await protocol.sendNotification('test/notification', { data: 'test' });

      expect(transport.sentMessages).toHaveLength(1);
      const notification = transport.sentMessages[0];
      expect(notification).toMatchObject({
        jsonrpc: '2.0',
        method: 'test/notification',
        params: { data: 'test' },
      });
      expect('id' in notification).toBe(false);
    });
  });
});
