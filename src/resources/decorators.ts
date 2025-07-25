import type { ResourceDefinition } from './types.js';

export interface ResourceOptions {
  uri?: string;
  name?: string;
  description?: string;
  mimeType?: string;
  cache?: boolean;
  cacheTtl?: number;
}

export interface ResourceMetadata {
  resources: Map<string, ResourceDefinition>;
}

const RESOURCE_METADATA_KEY = Symbol('resources');

export function getResourceMetadata(target: any): ResourceMetadata {
  if (!target[RESOURCE_METADATA_KEY]) {
    target[RESOURCE_METADATA_KEY] = {
      resources: new Map<string, ResourceDefinition>(),
    };
  }
  return target[RESOURCE_METADATA_KEY];
}

export function resource(options: ResourceOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      throw new Error(`@resource can only be applied to methods`);
    }

    // Generate URI if not provided
    const uri = options.uri ?? `resource://${target.constructor.name}/${propertyKey}`;
    const name = options.name ?? propertyKey;

    // Store resource metadata
    const metadata = getResourceMetadata(target.constructor);
    metadata.resources.set(uri, {
      uri,
      name,
      description: options.description,
      mimeType: options.mimeType,
      handler: originalMethod.bind(target),
    });

    // Return original method
    return descriptor;
  };
}

// Helper to create resource handler classes
export abstract class ResourceHandler {
  getResources(): ResourceDefinition[] {
    const metadata = getResourceMetadata(this.constructor);
    return Array.from(metadata.resources.values());
  }

  getResource(uri: string): ResourceDefinition | undefined {
    const metadata = getResourceMetadata(this.constructor);
    return metadata.resources.get(uri);
  }

  hasResource(uri: string): boolean {
    const metadata = getResourceMetadata(this.constructor);
    return metadata.resources.has(uri);
  }
}

// Example usage:
// class MyResources extends ResourceHandler {
//   @resource({
//     uri: 'file:///config.json',
//     name: 'Configuration',
//     description: 'Application configuration',
//     mimeType: 'application/json'
//   })
//   async getConfig(): Promise<McpResourceContents> {
//     return {
//       uri: 'file:///config.json',
//       mimeType: 'application/json',
//       text: JSON.stringify({ key: 'value' }, null, 2),
//     };
//   }
// }
