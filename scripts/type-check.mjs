#!/usr/bin/env node
/**
 * Vue SFC 类型检查入口（官方包双版本共存方案）。
 *
 * 背景：
 *  - TypeScript 7（tsgo 原生编译器）不再提供 `lib/tsc.js` / JS 编译器 API，
 *    vue-tsc 与 @volar/typescript 依赖这些 API 对 `tsc` 做运行时改写，
 *    因此无法直接跑在 TS 7 上。
 *  - 项目 package.json 中：
 *      "typescript":  "npm:@typescript/typescript6@6.0.2"  → 模板/ESLint 用的 TS6 API
 *      "typescript7": "npm:typescript@7.0.2"              → 官方 TS7 原生编译器（tsc / 编辑器）
 *
 * 方案：本脚本显式把官方 TypeScript 6 的 tsc 入口交给 vue-tsc 的 run()，
 * 不依赖 vue-tsc 内部 `require.resolve('typescript/lib/tsc')` 的解析结果，
 * 从而不受包管理器提升策略影响，安装结果可复现。
 * 使用的仍是 TypeScript 官方发行包，没有第三方 fork / 桥接。
 *
 * 未来 TS 7 若恢复 JS 编译器 API，只需把下方的入口改为 'typescript7/lib/tsc.js'。
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootRequire = createRequire(path.join(__dirname, '..', 'package.json'))

const candidates = ['typescript/lib/tsc.js', '@typescript/typescript6/lib/tsc.js']
let tscPath
for (const id of candidates) {
  try {
    tscPath = rootRequire.resolve(id)
    break
  } catch {
    // 继续尝试下一个候选
  }
}

if (!tscPath) {
  console.error(
    '[type-check] 未找到可用于 vue-tsc 的 TypeScript 编译器入口。\n' +
      '请确认已安装 typescript@7 与 @typescript/typescript6（官方 TS6 JS API 发行版）。'
  )
  process.exit(1)
}

const { run } = rootRequire('vue-tsc')
run(tscPath)
