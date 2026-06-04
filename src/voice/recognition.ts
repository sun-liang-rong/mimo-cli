// 语音模式 - 语音输入支持

import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const execAsync = promisify(exec)

export interface VoiceConfig {
  /** 语音识别服务: whisper | google | azure */
  provider: 'whisper' | 'google' | 'azure'
  /** API Key (如果需要) */
  apiKey?: string
  /** 语言代码 */
  language?: string
  /** 录音设备 (可选) */
  device?: string
  /** 最大录音时长 (秒) */
  maxDuration?: number
}

export interface VoiceResult {
  /** 识别的文本 */
  text: string
  /** 置信度 (0-1) */
  confidence?: number
  /** 语言 */
  language?: string
  /** 是否成功 */
  success: boolean
  /** 错误信息 */
  error?: string
}

const DEFAULT_CONFIG: VoiceConfig = {
  provider: 'whisper',
  language: 'zh',
  maxDuration: 30,
}

/**
 * 检查语音工具是否可用
 */
export async function checkVoiceTools(): Promise<{
  ffmpeg: boolean
  arecord: boolean
  whisper: boolean
}> {
  const check = async (cmd: string): Promise<boolean> => {
    try {
      await execAsync(`which ${cmd}`)
      return true
    } catch {
      return false
    }
  }

  return {
    ffmpeg: await check('ffmpeg'),
    arecord: await check('arecord'),
    whisper: await check('whisper'),
  }
}

/**
 * 录制音频
 * @param duration 录音时长 (秒)
 * @param device 录音设备
 * @returns 音频文件路径
 */
export async function recordAudio(
  duration: number = 5,
  device?: string
): Promise<string> {
  const tmpDir = os.tmpdir()
  const outputFile = path.join(tmpDir, `mimo-voice-${Date.now()}.wav`)

  // 使用 arecord (Linux) 或 ffmpeg (macOS)
  const platform = os.platform()
  let cmd: string

  if (platform === 'linux') {
    cmd = `arecord -d ${duration} -f S16_LE -r 16000 -c 1`
    if (device) {
      cmd += ` -D ${device}`
    }
    cmd += ` ${outputFile}`
  } else if (platform === 'darwin') {
    cmd = `ffmpeg -y -f avfoundation -i ":0" -t ${duration} -ar 16000 -ac 1 ${outputFile}`
  } else {
    throw new Error(`Unsupported platform: ${platform}`)
  }

  try {
    await execAsync(cmd, { timeout: (duration + 5) * 1000 })
    return outputFile
  } catch (error: any) {
    throw new Error(`Recording failed: ${error.message}`)
  }
}

/**
 * 使用 Whisper 识别音频
 * @param audioFile 音频文件路径
 * @param language 语言代码
 */
async function recognizeWithWhisper(
  audioFile: string,
  language: string = 'zh'
): Promise<VoiceResult> {
  try {
    const { stdout } = await execAsync(
      `whisper ${audioFile} --language ${language} --output_format txt --output_dir /tmp`,
      { timeout: 60000 }
    )

    // 读取输出文件
    const txtFile = audioFile.replace(/\.[^.]+$/, '.txt')
    const text = await fs.readFile(txtFile, 'utf-8')
    
    // 清理临时文件
    await fs.unlink(txtFile).catch(() => {})

    return {
      text: text.trim(),
      success: true,
      language,
    }
  } catch (error: any) {
    return {
      text: '',
      success: false,
      error: `Whisper failed: ${error.message}`,
    }
  }
}

/**
 * 使用 Google Speech-to-Text 识别音频
 * @param audioFile 音频文件路径
 * @param apiKey API Key
 * @param language 语言代码
 */
async function recognizeWithGoogle(
  audioFile: string,
  apiKey: string,
  language: string = 'zh-CN'
): Promise<VoiceResult> {
  try {
    // 读取音频文件并 base64 编码
    const audioBuffer = await fs.readFile(audioFile)
    const base64Audio = audioBuffer.toString('base64')

    // 调用 Google Speech-to-Text API
    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            encoding: 'LINEAR16',
            sampleRateHertz: 16000,
            languageCode: language,
          },
          audio: {
            content: base64Audio,
          },
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json() as any
    const results = data.results || []
    
    if (results.length === 0) {
      return {
        text: '',
        success: false,
        error: 'No speech detected',
      }
    }

    const transcript = results[0].alternatives?.[0]
    return {
      text: transcript?.transcript || '',
      confidence: transcript?.confidence,
      language,
      success: true,
    }
  } catch (error: any) {
    return {
      text: '',
      success: false,
      error: `Google STT failed: ${error.message}`,
    }
  }
}

/**
 * 识别语音
 * @param audioFile 音频文件路径
 * @param config 语音配置
 */
export async function recognizeSpeech(
  audioFile: string,
  config: Partial<VoiceConfig> = {}
): Promise<VoiceResult> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config }

  switch (fullConfig.provider) {
    case 'whisper':
      return recognizeWithWhisper(audioFile, fullConfig.language)
    
    case 'google':
      if (!fullConfig.apiKey) {
        return {
          text: '',
          success: false,
          error: 'Google API key required',
        }
      }
      return recognizeWithGoogle(audioFile, fullConfig.apiKey, fullConfig.language)
    
    default:
      return {
        text: '',
        success: false,
        error: `Unknown provider: ${fullConfig.provider}`,
      }
  }
}

/**
 * 完整的语音输入流程
 * @param config 语音配置
 */
export async function voiceInput(
  config: Partial<VoiceConfig> = {}
): Promise<VoiceResult> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config }

  // 检查工具
  const tools = await checkVoiceTools()
  if (!tools.arecord && os.platform() === 'linux') {
    return {
      text: '',
      success: false,
      error: 'arecord not found. Install with: apt install alsa-utils',
    }
  }

  if (fullConfig.provider === 'whisper' && !tools.whisper) {
    return {
      text: '',
      success: false,
      error: 'whisper not found. Install with: pip install openai-whisper',
    }
  }

  try {
    // 录制音频
    const audioFile = await recordAudio(fullConfig.maxDuration, fullConfig.device)

    // 识别语音
    const result = await recognizeSpeech(audioFile, config)

    // 清理临时文件
    await fs.unlink(audioFile).catch(() => {})

    return result
  } catch (error: any) {
    return {
      text: '',
      success: false,
      error: error.message,
    }
  }
}

/**
 * 格式化语音识别结果
 */
export function formatVoiceResult(result: VoiceResult): string {
  if (!result.success) {
    return `❌ Voice recognition failed: ${result.error}`
  }

  const lines = [
    '🎤 Voice Input',
    '─'.repeat(40),
    result.text,
  ]

  if (result.confidence) {
    lines.push(`\nConfidence: ${Math.round(result.confidence * 100)}%`)
  }

  if (result.language) {
    lines.push(`Language: ${result.language}`)
  }

  return lines.join('\n')
}
