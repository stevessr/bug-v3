#!/usr/bin/env node
/**
 * Convert extracted images into AVIF in .work/<group>/avif.
 */

import fs from 'fs'
import path from 'path'
import {
  ensureCommand,
  ensureDir,
  listGroupDirs,
  listImageFiles,
  safeFileStem,
  appendProgress,
  readProgressLog,
  runWithConcurrency,
  runCommand,
  getImageSize
} from './processing-utils.js'

const DEFAULT_WORK_DIR = path.resolve(process.cwd(), 'scripts/under_going/.work')
const DEFAULT_QUALITY = 80
const DEFAULT_AVIF_SPEED = 6
const DEFAULT_AVIF_JOBS = 1
const DEFAULT_CONVERT_CONCURRENCY = 12

function parseArgs(argv) {
  const args = {
    workdir: DEFAULT_WORK_DIR,
    quality: DEFAULT_QUALITY,
    avifSpeed: DEFAULT_AVIF_SPEED,
    avifJobs: DEFAULT_AVIF_JOBS,
    convertConcurrency: DEFAULT_CONVERT_CONCURRENCY,
    progressLog: null
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--workdir':
        args.workdir = path.resolve(process.cwd(), argv[++i])
        break
      case '--quality':
        args.quality = Number.parseInt(argv[++i], 10)
        break
      case '--avif-speed':
        args.avifSpeed = Number.parseInt(argv[++i], 10)
        break
      case '--avif-jobs':
        args.avifJobs = Number.parseInt(argv[++i], 10)
        break
      case '--convert-concurrency':
        args.convertConcurrency = Number.parseInt(argv[++i], 10)
        break
      case '--progress-log':
        args.progressLog = path.resolve(process.cwd(), argv[++i])
        break
      default:
        if (arg.startsWith('--')) {
          console.warn(`Unknown option ignored: ${arg}`)
        }
        break
    }
  }

  return args
}

async function convertToAvif(inputPath, outputPath, quality, speed, jobs) {
  ensureDir(path.dirname(outputPath))
  console.log(`Converting: ${inputPath} -> ${outputPath}`)
  await runCommand(
    'avifenc',
    [
      '--qcolor',
      String(quality),
      '--speed',
      String(speed),
      '--jobs',
      String(jobs),
      inputPath,
      outputPath
    ],
    { stdio: 'inherit' }
  )
}

async function convertGifToAvif(inputPath, outputPath) {
  ensureDir(path.dirname(outputPath))
  console.log(`Converting GIF (animated) via ffmpeg: ${inputPath} -> ${outputPath}`)
  await runCommand(
    'ffmpeg',
    [
      '-i',
      inputPath,
      '-c:v',
      'libaom-av1',
      '-crf',
      '30',
      '-b:v',
      '0',
      '-fps_mode',
      'passthrough',
      '-y',
      outputPath
    ],
    { stdio: 'inherit' }
  )
}

async function copyFile(inputPath, outputPath) {
  ensureDir(path.dirname(outputPath))
  console.log(`Copying AVIF: ${inputPath} -> ${outputPath}`)
  await fs.promises.copyFile(inputPath, outputPath)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.progressLog) {
    args.progressLog = path.join(args.workdir, 'progress.log')
  }
  console.log('Starting convert-under-going with args:', args)

  ensureCommand('magick', 'Install ImageMagick (magick command) for size detection.')
  ensureCommand('avifenc', 'Install libavif (avifenc command) for AVIF conversion.')
  ensureCommand('ffmpeg', 'Install ffmpeg for animated GIF conversion.')

  ensureDir(args.workdir)
  const progress = readProgressLog(args.progressLog)

  const groupDirs = listGroupDirs(args.workdir)
  if (groupDirs.length === 0) {
    console.log(`No group directories found in ${args.workdir}`)
    return
  }

  for (const groupDir of groupDirs) {
    const extractDir = path.join(groupDir, 'extract')
    if (!fs.existsSync(extractDir)) continue
    const groupName = path.basename(groupDir)
    const avifDir = path.join(groupDir, 'avif')
    ensureDir(avifDir)

    const imageFiles = listImageFiles(extractDir)
    if (imageFiles.length === 0) {
      console.warn(`No images found in ${extractDir}, skipping.`)
      continue
    }

    const tasks = imageFiles.map(imagePath => {
      const relativePath = path.relative(extractDir, imagePath)
      const ext = path.extname(imagePath).toLowerCase()
      const stem = safeFileStem(relativePath.replace(/\.[^.]+$/, ''))
      const outputName = `${stem}.avif`
      const outputPath = path.join(avifDir, outputName)
      const key = `${groupName}::${outputName}`
      return { imagePath, relativePath, ext, outputName, outputPath, key }
    })

    console.log(
      `Converting ${tasks.length} image(s) for ${groupName} with concurrency ${args.convertConcurrency} (avifenc jobs: ${args.avifJobs})`
    )

    await runWithConcurrency(tasks, args.convertConcurrency, async task => {
      const convertRecord = progress.converted.get(task.key)
      const hasConverted = convertRecord && fs.existsSync(task.outputPath)

      if (hasConverted) {
        console.log(`Skipping conversion (cached): ${task.relativePath}`)
      } else {
        console.log(`Converting: ${task.relativePath}`)
        if (task.ext === '.avif') {
          await copyFile(task.imagePath, task.outputPath)
        } else if (task.ext === '.gif') {
          await convertGifToAvif(task.imagePath, task.outputPath)
        } else {
          await convertToAvif(
            task.imagePath,
            task.outputPath,
            args.quality,
            args.avifSpeed,
            args.avifJobs
          )
        }
      }

      const size = fs.existsSync(task.outputPath) ? fs.statSync(task.outputPath).size : 0
      const dimensions = fs.existsSync(task.outputPath)
        ? getImageSize(task.outputPath)
        : { width: null, height: null }

      appendProgress(args.progressLog, {
        type: 'convert',
        key: task.key,
        outputName: task.outputName,
        outputPath: task.outputPath,
        size,
        width: dimensions.width,
        height: dimensions.height
      })
    })
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
