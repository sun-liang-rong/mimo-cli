/**
 * MiMo CLI 统一错误处理
 */

export class MimoError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MimoError';
    Object.setPrototypeOf(this, MimoError.prototype);
  }
}

export class APIError extends MimoError {
  constructor(message: string, public readonly statusCode?: number) {
    super(message, 'API_ERROR', { statusCode });
    this.name = 'APIError';
  }
}

export class ToolError extends MimoError {
  constructor(message: string, public readonly toolName?: string) {
    super(message, 'TOOL_ERROR', { toolName });
    this.name = 'ToolError';
  }
}

export class ConfigError extends MimoError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigError';
  }
}

export class ValidationError extends MimoError {
  constructor(message: string, public readonly field?: string) {
    super(message, 'VALIDATION_ERROR', { field });
    this.name = 'ValidationError';
  }
}

/**
 * 从错误对象提取可读的错误消息
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof MimoError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * 从错误对象提取完整的错误信息（用于日志）
 */
export function getErrorDetails(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}
