import type { McpPromptArgument } from '../core/types.js';
import type { PromptValidationResult } from './types.js';

export class PromptValidator {
  static validateArguments(
    args: Record<string, unknown>,
    requiredArguments: McpPromptArgument[] = [],
  ): PromptValidationResult {
    const errors: string[] = [];

    // Check required arguments
    for (const argDef of requiredArguments) {
      if (argDef.required === true && !(argDef.name in args)) {
        errors.push(`Missing required argument: ${argDef.name}`);
      }
    }

    // Check for unexpected arguments
    const allowedArgs = new Set(requiredArguments.map((arg) => arg.name));
    for (const argName of Object.keys(args)) {
      if (!allowedArgs.has(argName)) {
        errors.push(`Unexpected argument: ${argName}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static validatePromptName(name: string): PromptValidationResult {
    const errors: string[] = [];

    if (!name || typeof name !== 'string') {
      errors.push('Prompt name must be a non-empty string');
    } else {
      // Check for valid naming convention
      if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
        errors.push(
          'Prompt name must start with a letter and contain only letters, numbers, underscores, and hyphens',
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(args)) {
      // Basic sanitization - remove null/undefined values
      if (value !== null && value !== undefined) {
        if (typeof value === 'string') {
          // Trim whitespace from strings
          sanitized[key] = value.trim();
        } else {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  }
}
