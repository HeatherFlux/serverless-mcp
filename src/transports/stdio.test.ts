import { PassThrough } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JsonRpcMessage } from '../core/types.js';
import { StdioTransport } from './stdio.js';

describe('StdioTransport', () => {
  let mockStdin: PassThrough;
  let mockStdout: PassThrough;
  let mockStderr: PassThrough;
  let transport: StdioTransport;

  beforeEach(() => {
    mockStdin = new PassThrough();
    mockStdout = new PassThrough();
    mockStderr = new PassThrough();

    transport = StdioTransport.createMock(mockStdin, mockStdout, mockStderr);
  });

  describe('message sending', () => {
    it('should send JSON-RPC messages', async () => {
      const message: JsonRpcMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      };

      let outputData = '';
      mockStdout.on('data', (chunk) => {
        outputData += chunk;
      });

      await transport.send(message);

      expect(outputData).toBe('{"jsonrpc":"2.0","id":1,"method":"test"}\n');
    });

    it('should reject messages that are too large', async () => {
      const largeMessage: JsonRpcMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: 'x'.repeat(2 * 1024 * 1024), // 2MB
      };

      await expect(transport.send(largeMessage)).rejects.toThrow('Message too large');
    });

    it('should update metrics on send', async () => {
      const message: JsonRpcMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      };

      await transport.send(message);

      const metrics = transport.getMetrics();
      expect(metrics.messagesSent).toBe(1);
      expect(metrics.bytesSent).toBeGreaterThan(0);
    });
  });

  describe('message receiving', () => {
    it('should receive and parse JSON-RPC messages', (done) => {
      const expectedMessage: JsonRpcMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      };

      transport.onMessage((message) => {
        expect(message).toEqual(expectedMessage);

        const metrics = transport.getMetrics();
        expect(metrics.messagesReceived).toBe(1);
        expect(metrics.bytesReceived).toBeGreaterThan(0);

        done();
      });

      mockStdin.push('{"jsonrpc":"2.0","id":1,"method":"test"}\n');
    });

    it('should handle invalid JSON gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      return new Promise<void>((resolve, reject) => {
        let errorOutput = '';
        mockStderr.on('data', (chunk) => {
          errorOutput += chunk;

          // Check once we have error output
          try {
            expect(errorOutput).toContain('Invalid JSON received');

            const metrics = transport.getMetrics();
            expect(metrics.errors).toBe(1);

            consoleSpy.mockRestore();
            resolve();
          } catch (error) {
            consoleSpy.mockRestore();
            reject(error);
          }
        });

        transport.onMessage(() => {
          // Should not be called
          consoleSpy.mockRestore();
          reject(new Error('Message handler should not be called for invalid JSON'));
        });

        mockStdin.push('invalid json\n');
      });
    });

    it('should reject messages that are too large', async () => {
      return new Promise<void>((resolve, reject) => {
        let errorOutput = '';
        mockStderr.on('data', (chunk) => {
          errorOutput += chunk;

          try {
            expect(errorOutput).toContain('Message too large');

            const metrics = transport.getMetrics();
            expect(metrics.errors).toBe(1);
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        transport.onMessage(() => {
          reject(new Error('Message handler should not be called for large messages'));
        });

        const largeMessage = 'x'.repeat(2 * 1024 * 1024); // 2MB
        mockStdin.push(`${largeMessage}\n`);
      });
    });
  });

  describe('connection management', () => {
    it('should report connected status', () => {
      expect(transport.isConnected()).toBe(true);
    });

    it('should handle stdin end event', (done) => {
      expect(transport.isConnected()).toBe(true);

      mockStdin.on('end', () => {
        setTimeout(() => {
          expect(transport.isConnected()).toBe(false);
          done();
        }, 10);
      });

      mockStdin.push(null); // End the stream
    });

    it('should close gracefully', async () => {
      await transport.close();
      expect(transport.isConnected()).toBe(false);
    });
  });

  describe('metrics', () => {
    it('should track connection time', () => {
      const metrics = transport.getMetrics();
      expect(metrics.connectionTime).toBeDefined();
      expect(metrics.connectionTime).toBeTypeOf('number');
    });

    it('should initialize metrics correctly', () => {
      const metrics = transport.getMetrics();
      expect(metrics.messagesSent).toBe(0);
      expect(metrics.messagesReceived).toBe(0);
      expect(metrics.bytesReceived).toBe(0);
      expect(metrics.bytesSent).toBe(0);
      expect(metrics.errors).toBe(0);
    });
  });
});
