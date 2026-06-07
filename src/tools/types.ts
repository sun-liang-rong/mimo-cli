export interface ToolParameter {
  type: string;
  description: string;
  properties?: Record<string, ToolParameter>;
  required?: string[];
  items?: ToolParameter;
  [key: string]: unknown;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: ToolParameter;
  };
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;

/**
 * Metadata about a tool for the agent to make smarter decisions.
 */
export interface ToolMetadata {
  /** Whether this tool only reads data (no side effects) */
  readOnly: boolean;
  /** Estimated cost tier: 'low' for fast ops, 'medium' for file writes, 'high' for commands */
  cost: 'low' | 'medium' | 'high';
  /** Suggested max output length for this tool type */
  maxOutputLength: number;
}
