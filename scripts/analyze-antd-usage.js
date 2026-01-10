#!/usr/bin/env node

/**
 * Ant Design Vue Component Usage Analyzer
 * 分析项目中实际使用的 Ant Design Vue 组件
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 统计
const stats = {
  filesScanned: 0,
  componentsUsed: new Set(),
  iconsUsed: new Set(),
  directImports: new Set(),
  filesByComponent: new Map()
}

/**
 * Ant Design Vue 组件列表（常用的）
 */
const antdComponents = [
  'Button', 'Input', 'Select', 'Modal', 'Table', 'Form', 'FormItem',
  'Switch', 'Checkbox', 'Radio', 'DatePicker', 'Upload', 'Dropdown',
  'Menu', 'MenuItem', 'Tabs', 'TabPane', 'Card', 'Spin', 'Space',
  'Row', 'Col', 'Divider', 'Tag', 'Badge', 'Tooltip', 'Popover',
  'Message', 'Notification', 'Drawer', 'Layout', 'Header', 'Content',
  'Footer', 'Sider', 'Breadcrumb', 'BreadcrumbItem', 'Pagination',
  'Steps', 'Step', 'Progress', 'Alert', 'Tree', 'TreeSelect',
  'Cascader', 'AutoComplete', 'Rate', 'Slider', 'InputNumber',
  'Collapse', 'CollapsePanel', 'Timeline', 'TimelineItem', 'Transfer',
  'Anchor', 'AnchorLink', 'BackTop', 'Avatar', 'List', 'ListItem',
  'Statistic', 'Skeleton', 'Empty', 'Result', 'Descriptions',
  'DescriptionsItem', 'Calendar', 'Image', 'ConfigProvider', 'Affix'
]

/**
 * 从文件内容中提取使用的组件
 */
function extractComponents(content, filePath) {
  const components = new Set()
  const icons = new Set()

  // 1. 检测模板中的组件使用 <a-button>, <AButton>
  const templateComponentRegex = /<a-([a-z-]+)|<A([A-Z][a-zA-Z]*)/g
  let match
  while ((match = templateComponentRegex.exec(content)) !== null) {
    const componentName = match[1]
      ? kebabToPascal(match[1])
      : match[2]

    if (antdComponents.includes(componentName)) {
      components.add(componentName)
      if (!stats.filesByComponent.has(componentName)) {
        stats.filesByComponent.set(componentName, new Set())
      }
      stats.filesByComponent.get(componentName).add(filePath)
    }
  }

  // 2. 检测直接导入 import { Button } from 'ant-design-vue'
  const importRegex = /import\s+{([^}]+)}\s+from\s+['"]ant-design-vue['"]/g
  while ((match = importRegex.exec(content)) !== null) {
    const imports = match[1].split(',').map(s => s.trim())
    imports.forEach(imp => {
      const componentName = imp.replace(/\s+as\s+.*/, '').trim()
      if (componentName) {
        components.add(componentName)
        stats.directImports.add(componentName)
      }
    })
  }

  // 3. 检测图标使用
  const iconRegex = /<([A-Z][a-zA-Z]*)(Outlined|Filled|TwoTone)\s/g
  while ((match = iconRegex.exec(content)) !== null) {
    const iconName = match[1] + match[2]
    icons.add(iconName)
  }

  // 4. 检测 message 和 notification 全局方法
  if (/message\.(success|error|warning|info|loading)/.test(content)) {
    components.add('Message')
  }
  if (/notification\.(success|error|warning|info)/.test(content)) {
    components.add('Notification')
  }

  return { components, icons }
}

/**
 * kebab-case 转 PascalCase
 */
function kebabToPascal(str) {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

/**
 * 扫描文件
 */
function scanFile(filePath) {
  stats.filesScanned++

  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const { components, icons } = extractComponents(content, filePath)

    components.forEach(c => stats.componentsUsed.add(c))
    icons.forEach(i => stats.iconsUsed.add(i))
  } catch (error) {
    console.error(`Error scanning ${filePath}:`, error.message)
  }
}

/**
 * 递归扫描目录
 */
function scanDirectory(dir, extensions = ['.vue', '.ts', '.tsx']) {
  const files = fs.readdirSync(dir)

  files.forEach(file => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        scanDirectory(filePath, extensions)
      }
    } else if (stat.isFile()) {
      const ext = path.extname(file)
      if (extensions.includes(ext)) {
        scanFile(filePath)
      }
    }
  })
}

/**
 * 生成报告
 */
function generateReport() {
  console.log('\n' + '='.repeat(60))
  console.log('📊 Ant Design Vue Component Usage Analysis')
  console.log('='.repeat(60) + '\n')

  console.log(`📁 Files Scanned: ${stats.filesScanned}`)
  console.log(`🧩 Components Used: ${stats.componentsUsed.size}`)
  console.log(`🎨 Icons Used: ${stats.iconsUsed.size}`)
  console.log(`📦 Direct Imports: ${stats.directImports.size}\n`)

  console.log('=' .repeat(60))
  console.log('🧩 Components Used:')
  console.log('='.repeat(60))

  const sortedComponents = Array.from(stats.componentsUsed).sort()
  sortedComponents.forEach((component, idx) => {
    const files = stats.filesByComponent.get(component)
    const fileCount = files ? files.size : 0
    console.log(`${(idx + 1).toString().padStart(2)}. ${component.padEnd(20)} (${fileCount} files)`)
  })

  if (stats.iconsUsed.size > 0) {
    console.log('\n' + '='.repeat(60))
    console.log('🎨 Icons Used:')
    console.log('='.repeat(60))

    const sortedIcons = Array.from(stats.iconsUsed).sort()
    sortedIcons.forEach((icon, idx) => {
      console.log(`${(idx + 1).toString().padStart(2)}. ${icon}`)
    })
  }

  if (stats.directImports.size > 0) {
    console.log('\n' + '='.repeat(60))
    console.log('📦 Direct Imports (需要检查):')
    console.log('='.repeat(60))

    const sortedImports = Array.from(stats.directImports).sort()
    sortedImports.forEach((imp, idx) => {
      console.log(`${(idx + 1).toString().padStart(2)}. ${imp}`)
    })
  }

  // 生成优化建议
  console.log('\n' + '='.repeat(60))
  console.log('💡 Optimization Suggestions:')
  console.log('='.repeat(60))

  const totalPossibleComponents = antdComponents.length
  const usagePercentage = ((stats.componentsUsed.size / totalPossibleComponents) * 100).toFixed(1)

  console.log(`\n✅ Current Usage: ${stats.componentsUsed.size}/${totalPossibleComponents} components (${usagePercentage}%)`)

  if (usagePercentage < 50) {
    console.log(`\n🎯 Good news! You're using less than 50% of common Ant Design Vue components.`)
    console.log(`   The unplugin-vue-components auto-import is already optimizing your bundle.`)
  } else {
    console.log(`\n⚠️  You're using ${usagePercentage}% of common components.`)
    console.log(`   This is reasonable for a feature-rich application.`)
  }

  if (stats.directImports.size > 0) {
    console.log(`\n⚠️  Found ${stats.directImports.size} direct imports.`)
    console.log(`   Consider removing these and relying on auto-import instead.`)
  }

  console.log('\n📋 Recommended Actions:')
  console.log('   1. Keep using unplugin-vue-components (already configured)')
  console.log('   2. Remove any direct imports if found')
  console.log('   3. Current vendor-ui.js size is acceptable for the usage')

  console.log('\n' + '='.repeat(60) + '\n')
}

/**
 * 保存详细报告
 */
function saveDetailedReport() {
  const reportPath = path.join(__dirname, '..', 'docs', 'optimizations', 'ANTD_USAGE_REPORT.md')

  let content = `# Ant Design Vue Usage Report\n\n`
  content += `**Generated:** ${new Date().toISOString()}\n\n`
  content += `## Statistics\n\n`
  content += `- Files Scanned: ${stats.filesScanned}\n`
  content += `- Components Used: ${stats.componentsUsed.size}\n`
  content += `- Icons Used: ${stats.iconsUsed.size}\n`
  content += `- Direct Imports: ${stats.directImports.size}\n\n`

  content += `## Components Used (${stats.componentsUsed.size})\n\n`
  const sortedComponents = Array.from(stats.componentsUsed).sort()
  sortedComponents.forEach((component, idx) => {
    const files = stats.filesByComponent.get(component)
    const fileCount = files ? files.size : 0
    content += `${idx + 1}. **${component}** - Used in ${fileCount} file(s)\n`
  })

  if (stats.iconsUsed.size > 0) {
    content += `\n## Icons Used (${stats.iconsUsed.size})\n\n`
    const sortedIcons = Array.from(stats.iconsUsed).sort()
    sortedIcons.forEach((icon, idx) => {
      content += `${idx + 1}. ${icon}\n`
    })
  }

  content += `\n## Component Details\n\n`
  sortedComponents.forEach(component => {
    const files = stats.filesByComponent.get(component)
    if (files && files.size > 0) {
      content += `### ${component}\n\n`
      content += `Used in ${files.size} file(s):\n`
      Array.from(files).sort().forEach(file => {
        const relativePath = path.relative(path.join(__dirname, '..'), file)
        content += `- \`${relativePath}\`\n`
      })
      content += `\n`
    }
  })

  fs.writeFileSync(reportPath, content, 'utf-8')
  console.log(`📄 Detailed report saved to: ${reportPath}`)
}

/**
 * Main
 */
function main() {
  const srcDir = path.join(__dirname, '..', 'src')

  console.log('🔍 Analyzing Ant Design Vue component usage...\n')

  // 只扫描 options 和 popup (主要使用 UI 组件的地方)
  const targetDirs = ['options', 'popup'].map(d => path.join(srcDir, d))

  targetDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      console.log(`📁 Scanning ${path.basename(dir)}/`)
      scanDirectory(dir)
    }
  })

  generateReport()
  saveDetailedReport()
}

main()
