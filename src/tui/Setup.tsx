// 配置引导组件 - 当配置不完整时交互式引导用户设置

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { Config } from '../config/store.js'

interface SetupProps {
  onComplete: (config: Config) => void
  onCancel: () => void
  initialConfig: Config
}

type SetupStep = 'api-key' | 'base-url' | 'model' | 'confirm'

export function Setup({ onComplete, onCancel, initialConfig }: SetupProps) {
  const [step, setStep] = useState<SetupStep>(
    initialConfig.apiKey ? 'base-url' : 'api-key'
  )
  const [apiKey, setApiKey] = useState(initialConfig.apiKey)
  const [baseURL, setBaseURL] = useState(initialConfig.baseURL)
  const [model, setModel] = useState(initialConfig.model)

  useInput((input, key) => {
    // Ctrl+C 取消
    if (key.ctrl && input === 'c') {
      onCancel()
      return
    }

    // Enter 确认当前步骤
    if (key.return) {
      if (step === 'api-key') {
        if (apiKey.trim()) {
          setStep('base-url')
        }
      } else if (step === 'base-url') {
        if (baseURL.trim()) {
          setStep('model')
        }
      } else if (step === 'model') {
        if (model.trim()) {
          setStep('confirm')
        }
      } else if (step === 'confirm') {
        onComplete({ apiKey, baseURL, model })
      }
      return
    }

    // Backspace 删除
    if (key.backspace || key.delete) {
      if (step === 'api-key') setApiKey((p) => p.slice(0, -1))
      else if (step === 'base-url') setBaseURL((p) => p.slice(0, -1))
      else if (step === 'model') setModel((p) => p.slice(0, -1))
      return
    }

    // 普通字符输入
    if (input && !key.ctrl && !key.meta) {
      if (step === 'api-key') setApiKey((p) => p + input)
      else if (step === 'base-url') setBaseURL((p) => p + input)
      else if (step === 'model') setModel((p) => p + input)
    }
  })

  return (
    <Box flexDirection="column" padding={1}>
      {/* 标题 */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🚀 MiMo CLI 初始配置
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="gray">
          首次运行需要配置 API 信息，配置将保存到 ~/.mimo/config.json
        </Text>
      </Box>

      {/* 步骤 1: API Key */}
      <StepInput
        label="API Key"
        step="api-key"
        currentStep={step}
        value={apiKey}
        placeholder="输入你的 MiMo API Key"
        maskInput={true}
      />

      {/* 步骤 2: Base URL */}
      {(step === 'base-url' || step === 'model' || step === 'confirm') && (
        <StepInput
          label="API Base URL"
          step="base-url"
          currentStep={step}
          value={baseURL}
          placeholder="https://api.xiaomimimo.com/v1"
        />
      )}

      {/* 步骤 3: Model */}
      {(step === 'model' || step === 'confirm') && (
        <StepInput
          label="Model Name"
          step="model"
          currentStep={step}
          value={model}
          placeholder="MiMo-7B-RL"
        />
      )}

      {/* 确认步骤 */}
      {step === 'confirm' && (
        <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="green" padding={1}>
          <Text bold color="green">📋 配置摘要</Text>
          <Box marginTop={1} flexDirection="column">
            <Text>  API Key:  <Text color="cyan">{apiKey.slice(0, 8)}****{apiKey.slice(-4)}</Text></Text>
            <Text>  Base URL: <Text color="cyan">{baseURL}</Text></Text>
            <Text>  Model:    <Text color="cyan">{model}</Text></Text>
          </Box>
          <Box marginTop={1}>
            <Text color="gray">按 <Text bold color="green">Enter</Text> 保存并开始，或 <Text bold color="red">Ctrl+C</Text> 取消</Text>
          </Box>
        </Box>
      )}

      {/* 底部提示 */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          {step === 'confirm' ? '' : '输入后按 Enter 继续 | Ctrl+C 退出'}
        </Text>
      </Box>
    </Box>
  )
}

interface StepInputProps {
  label: string
  step: SetupStep
  currentStep: SetupStep
  value: string
  placeholder: string
  maskInput?: boolean
}

function StepInput({
  label,
  step,
  currentStep,
  value,
  placeholder,
  maskInput,
}: StepInputProps) {
  const isActive = step === currentStep
  const isDone =
    (step === 'api-key' && currentStep !== 'api-key') ||
    (step === 'base-url' && currentStep !== 'base-url' && currentStep !== 'api-key') ||
    (step === 'model' && currentStep === 'confirm')

  const displayValue = maskInput && value
    ? '*'.repeat(Math.min(value.length, 20))
    : value

  return (
    <Box marginY={0} paddingLeft={1}>
      <Text color={isActive ? 'yellow' : isDone ? 'green' : 'gray'}>
        {isDone ? '✅' : isActive ? '▶' : '○'} {label}:{' '}
      </Text>
      {isActive ? (
        <Text>
          {displayValue || <Text color="gray">{placeholder}</Text>}
          <Text color="yellow">█</Text>
        </Text>
      ) : isDone ? (
        <Text color="cyan">
          {maskInput ? '*'.repeat(8) + '****' : displayValue}
        </Text>
      ) : (
        <Text color="gray">{placeholder}</Text>
      )}
    </Box>
  )
}
