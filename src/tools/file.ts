import * as fs from 'fs';
import * as path from 'path';
import { ToolDefinition, ToolHandler, ToolResult } from './types';
import { ToolRegistry } from './registry';

export const readFileTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'read_file',
    description: '读取文件内容',
    parameters: {
      type: 'object',
      description: '文件路径参数',
      properties: {
        path: {
          type: 'string',
          description: '文件路径'
        }
      },
      required: ['path']
    }
  }
};

export const readFileHandler: ToolHandler = async (args): Promise<ToolResult> => {
  try {
    const content = fs.readFileSync(args.path, 'utf-8');
    return {
      success: true,
      output: content
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `无法读取文件: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

export const writeFileTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'write_file',
    description: '写入文件内容',
    parameters: {
      type: 'object',
      description: '文件写入参数',
      properties: {
        path: {
          type: 'string',
          description: '文件路径'
        },
        content: {
          type: 'string',
          description: '文件内容'
        }
      },
      required: ['path', 'content']
    }
  }
};

export const writeFileHandler: ToolHandler = async (args): Promise<ToolResult> => {
  try {
    const dir = path.dirname(args.path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(args.path, args.content, 'utf-8');
    return {
      success: true,
      output: `文件已写入: ${args.path}`
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `无法写入文件: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

export const listFilesTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_files',
    description: '列出目录中的文件',
    parameters: {
      type: 'object',
      description: '目录路径参数',
      properties: {
        path: {
          type: 'string',
          description: '目录路径，默认为当前目录'
        }
      }
    }
  }
};

export const listFilesHandler: ToolHandler = async (args): Promise<ToolResult> => {
  try {
    const dir = args.path || '.';
    const files = fs.readdirSync(dir);
    return {
      success: true,
      output: files.join('\n')
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `无法列出文件: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

export function registerFileTools(registry: ToolRegistry): void {
  registry.register(readFileTool, readFileHandler);
  registry.register(writeFileTool, writeFileHandler);
  registry.register(listFilesTool, listFilesHandler);
}
