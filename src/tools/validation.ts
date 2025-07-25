import type { ToolValidationResult } from './types.js';

export class ToolValidator {
  static validateToolName(name: string): ToolValidationResult {
    const errors: string[] = [];

    if (!name || typeof name !== 'string') {
      errors.push('Tool name must be a non-empty string');
    } else {
      // Check for valid naming convention
      if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
        errors.push(
          'Tool name must start with a letter and contain only letters, numbers, underscores, and hyphens',
        );
      }

      // Check length
      if (name.length > 64) {
        errors.push('Tool name must be 64 characters or less');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static validateInputSchema(schema: Record<string, unknown>): ToolValidationResult {
    const errors: string[] = [];

    // Basic JSON Schema validation
    if (!schema || typeof schema !== 'object') {
      errors.push('Input schema must be a valid object');
      return { valid: false, errors };
    }

    // Check for required JSON Schema properties
    if (!schema.type) {
      errors.push('Input schema must have a "type" property');
    } else if (schema.type !== 'object') {
      errors.push('Input schema type must be "object" for tool parameters');
    }

    // Validate properties if they exist
    if (schema.properties && typeof schema.properties !== 'object') {
      errors.push('Input schema "properties" must be an object');
    }

    // Validate required array if it exists
    if (schema.required && !Array.isArray(schema.required)) {
      errors.push('Input schema "required" must be an array');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static validateArgs(
    args: Record<string, unknown>,
    schema: Record<string, unknown>,
  ): ToolValidationResult {
    const errors: string[] = [];

    // Extract schema information
    const properties = (schema.properties as Record<string, any>) || {};
    const required = (schema.required as string[]) || [];

    // Check required properties
    for (const requiredProp of required) {
      if (!(requiredProp in args)) {
        errors.push(`Missing required parameter: ${requiredProp}`);
      }
    }

    // Validate provided arguments against schema
    for (const [argName, argValue] of Object.entries(args)) {
      const propSchema = properties[argName];

      if (!propSchema) {
        errors.push(`Unexpected parameter: ${argName}`);
        continue;
      }

      // Basic type validation
      if (propSchema.type) {
        const expectedType = propSchema.type;
        const actualType = ToolValidator.getJavaScriptType(argValue);

        if (!ToolValidator.isTypeCompatible(actualType, expectedType, argValue)) {
          errors.push(`Parameter ${argName} expected type ${expectedType}, got ${actualType}`);
        }
      }

      // Validate string constraints
      if (propSchema.type === 'string' && typeof argValue === 'string') {
        if (propSchema.minLength && argValue.length < propSchema.minLength) {
          errors.push(`Parameter ${argName} must be at least ${propSchema.minLength} characters`);
        }
        if (propSchema.maxLength && argValue.length > propSchema.maxLength) {
          errors.push(`Parameter ${argName} must be at most ${propSchema.maxLength} characters`);
        }
        if (propSchema.pattern && !new RegExp(propSchema.pattern).test(argValue)) {
          errors.push(`Parameter ${argName} does not match required pattern`);
        }
      }

      // Validate number constraints
      if (
        (propSchema.type === 'number' || propSchema.type === 'integer') &&
        typeof argValue === 'number'
      ) {
        if (propSchema.minimum !== undefined && argValue < propSchema.minimum) {
          errors.push(`Parameter ${argName} must be at least ${propSchema.minimum}`);
        }
        if (propSchema.maximum !== undefined && argValue > propSchema.maximum) {
          errors.push(`Parameter ${argName} must be at most ${propSchema.maximum}`);
        }
        if (propSchema.type === 'integer' && !Number.isInteger(argValue)) {
          errors.push(`Parameter ${argName} must be an integer`);
        }
      }

      // Validate array constraints
      if (propSchema.type === 'array' && Array.isArray(argValue)) {
        if (propSchema.minItems && argValue.length < propSchema.minItems) {
          errors.push(`Parameter ${argName} must have at least ${propSchema.minItems} items`);
        }
        if (propSchema.maxItems && argValue.length > propSchema.maxItems) {
          errors.push(`Parameter ${argName} must have at most ${propSchema.maxItems} items`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private static getJavaScriptType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  private static isTypeCompatible(
    actualType: string,
    expectedType: string,
    value?: unknown,
  ): boolean {
    // Direct match
    if (actualType === expectedType) return true;

    // Special cases
    if (expectedType === 'integer' && actualType === 'number') {
      return Number.isInteger(value);
    }

    return false;
  }

  static sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(args)) {
      // Remove null/undefined values
      if (value !== null && value !== undefined) {
        if (typeof value === 'string') {
          // Trim whitespace from strings
          sanitized[key] = value.trim();
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          // Recursively sanitize objects
          sanitized[key] = ToolValidator.sanitizeArgs(value as Record<string, unknown>);
        } else {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  }
}
