/**
 * 冒泡排序算法
 * 时间复杂度: O(n²)
 * 空间复杂度: O(1)
 * 稳定性: 稳定排序
 */

export function bubbleSort(arr: number[]): number[] {
  // 创建数组副本，避免修改原数组
  const result = [...arr]
  const n = result.length

  // 外层循环：控制排序轮数
  for (let i = 0; i < n - 1; i++) {
    let swapped = false

    // 内层循环：比较相邻元素并交换
    // 每轮排序后，最大的元素会"冒泡"到最后
    for (let j = 0; j < n - 1 - i; j++) {
      if (result[j] > result[j + 1]) {
        // 交换元素
        ;[result[j], result[j + 1]] = [result[j + 1], result[j]]
        swapped = true
      }
    }

    // 如果这一轮没有发生交换，说明数组已经有序
    if (!swapped) {
      break
    }
  }

  return result
}

/**
 * 测试冒泡排序
 */
export function testBubbleSort(): void {
  console.log('🧪 测试冒泡排序算法\n')

  // 测试用例
  const testCases = [
    {
      name: '普通数组',
      input: [64, 34, 25, 12, 22, 11, 90],
      expected: [11, 12, 22, 25, 34, 64, 90],
    },
    {
      name: '已排序数组',
      input: [1, 2, 3, 4, 5],
      expected: [1, 2, 3, 4, 5],
    },
    {
      name: '逆序数组',
      input: [5, 4, 3, 2, 1],
      expected: [1, 2, 3, 4, 5],
    },
    {
      name: '包含重复元素',
      input: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5],
      expected: [1, 1, 2, 3, 3, 4, 5, 5, 5, 6, 9],
    },
    {
      name: '空数组',
      input: [],
      expected: [],
    },
    {
      name: '单元素数组',
      input: [42],
      expected: [42],
    },
    {
      name: '两个元素',
      input: [2, 1],
      expected: [1, 2],
    },
    {
      name: '负数数组',
      input: [-3, -1, -4, -1, -5],
      expected: [-5, -4, -3, -1, -1],
    },
  ]

  let passed = 0
  let failed = 0

  for (const testCase of testCases) {
    const result = bubbleSort(testCase.input)
    const isSuccess = JSON.stringify(result) === JSON.stringify(testCase.expected)

    if (isSuccess) {
      console.log(`✅ ${testCase.name}: 通过`)
      passed++
    } else {
      console.log(`❌ ${testCase.name}: 失败`)
      console.log(`   输入: ${JSON.stringify(testCase.input)}`)
      console.log(`   期望: ${JSON.stringify(testCase.expected)}`)
      console.log(`   实际: ${JSON.stringify(result)}`)
      failed++
    }
  }

  console.log(`\n📊 测试结果: ${passed} 通过, ${failed} 失败`)

  if (failed === 0) {
    console.log('🎉 所有测试用例都通过了！')
  }
}

// 如果直接运行此文件，执行测试
if (process.argv[1]?.includes('bubble-sort')) {
  testBubbleSort()
}
