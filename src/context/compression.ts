// 智能上下文压缩器 - 已迁移至 manager.ts，此文件仅做向后兼容 re-export

export {
  compressMessages,
  quickCompress,
  needsCompression,
} from './manager.js'

export type {
  CompressionResult,
  CompressorConfig,
} from './manager.js'
