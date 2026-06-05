export interface ToolParameter {
  type: string;
  description: string;
  properties?: Record<string, ToolParameter>;
  required?: string[];
  items?: ToolParameter;
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

export type ToolHandler = (args: Record<string, any>) => Promise<ToolResult>;