#!/usr/bin/env node
// Build script for autonomous platform scripts
// Compiles autonomous scripts into standalone JavaScript files

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const autonomousDir = path.resolve(rootDir, 'src', 'autonomous-scripts');
const outputDir = path.resolve(rootDir, 'dist', 'autonomous');

// Platform scripts to build
const PLATFORM_SCRIPTS = [
  'discourse-script.ts',
  'x-script.ts', 
  'pixiv-script.ts',
  'reddit-script.ts',
  'loader.ts'
];

// Simple TypeScript compilation function
async function compileTypeScript(inputFile, outputFile) {
  return new Promise((resolve) => {
    const tscPath = path.resolve(rootDir, 'node_modules', '.bin', 'tsc');
    
    const child = spawn(tscPath, [inputFile, '--outFile', outputFile, '--target', 'ES2020', '--lib', 'ES2020,DOM,DOM.Iterable'], {
      stdio: 'inherit',
      cwd: rootDir,
      shell: true
    });

    child.on('exit', (code) => {
      resolve(code === 0);
    });

    child.on('error', (err) => {
      console.error(`Failed to compile ${inputFile}:`, err);
      resolve(false);
    });
  });
}

// Manual TypeScript-like compilation (simplified)
function manualCompile(content) {
  // Remove TypeScript type annotations and interfaces
  let compiled = content;
  
  // Remove type annotations from function parameters
  compiled = compiled.replace(/(\w+):\s*[\w\[\]<>|&\s]+(\s*[,)])/g, '$1$2');
  
  // Remove return type annotations
  compiled = compiled.replace(/\):\s*[\w\[\]<>|&\s]+(\s*{)/g, ')$1');
  
  // Remove interface declarations
  compiled = compiled.replace(/interface\s+\w+\s*{[^}]*}/g, '');
  
  // Remove type aliases
  compiled = compiled.replace(/type\s+\w+\s*=.*?;/g, '');
  
  // Remove as Type assertions
  compiled = compiled.replace(/\s+as\s+[\w\[\]<>|&\s]+/g, '');
  
  // Remove generic type parameters
  compiled = compiled.replace(/<[\w\[\]<>|&\s,]+>/g, '');
  
  // Clean up extra whitespace
  compiled = compiled.replace(/\s+/g, ' ').replace(/\s*;\s*/g, ';');
  
  return compiled;
}

// Process a single script file
async function processScript(scriptName) {
  try {
    const inputPath = path.resolve(autonomousDir, scriptName);
    const outputName = scriptName.replace('.ts', '.js');
    const outputPath = path.resolve(outputDir, outputName);
    
    console.log('📦 Processing ' + scriptName + '...');
    
    // Read the TypeScript source
    if (!fs.existsSync(inputPath)) {
      console.error('❌ Input file not found: ' + inputPath);
      return false;
    }
    
    const sourceContent = fs.readFileSync(inputPath, 'utf8');
    
    // Try TypeScript compiler first
    let compiled;
    const tempOutputPath = path.resolve(outputDir, 'temp_' + outputName);
    
    try {
      const tscSuccess = await compileTypeScript(inputPath, tempOutputPath);
      if (tscSuccess && fs.existsSync(tempOutputPath)) {
        compiled = fs.readFileSync(tempOutputPath, 'utf8');
        fs.unlinkSync(tempOutputPath); // Clean up temp file
      } else {
        throw new Error('TypeScript compilation failed');
      }
    } catch (e) {
      console.warn('⚠️ TypeScript compiler failed for ' + scriptName + ', using manual compilation');
      compiled = manualCompile(sourceContent);
    }
    
    // Ensure the compiled script is wrapped properly
    if (!compiled.includes('(function()')) {
      compiled = '(function() {\n\'use strict\';\n\n' + compiled + '\n\n})();';
    }
    
    // Add header comment
    const header = '// Autonomous Platform Script - ' + scriptName.replace('.ts', '') + '\n// Generated at ' + new Date().toISOString() + '\n// Do not edit manually - this file is auto-generated\n\n';
    compiled = header + compiled;
    
    // Write the output
    fs.writeFileSync(outputPath, compiled, 'utf8');
    
    // Calculate file sizes
    const sourceSize = (fs.statSync(inputPath).size / 1024).toFixed(2);
    const outputSize = (fs.statSync(outputPath).size / 1024).toFixed(2);
    
    console.log('✅ ' + scriptName + ' -> ' + outputName + ' (' + sourceSize + 'KB -> ' + outputSize + 'KB)');
    return true;
  } catch (e) {
    console.error('❌ Failed to process ' + scriptName + ':', e);
    return false;
  }
}

// Create an index file that exports all scripts
function createIndexFile() {
  const indexContent = '// Autonomous Scripts Index\n// Auto-generated file - do not edit manually\n\nexport const AUTONOMOUS_SCRIPTS = {\n' +
PLATFORM_SCRIPTS.map(script => {
  const name = script.replace('.ts', '').replace('-script', '').replace('-', '_');
  const fileName = script.replace('.ts', '.js');
  return '  ' + name + ': () => import(\'./' + fileName + '\')';
}).join(',\n') + '\n};\n\nexport const SCRIPT_NAMES = [\n' +
PLATFORM_SCRIPTS.map(script => '  \'' + script.replace('.ts', '') + '\'').join(',\n') + '\n];\n\n// Get script content by platform name\nexport function getScriptContent(platform) {\n  const scriptMap = {\n' +
PLATFORM_SCRIPTS.filter(s => s !== 'loader.ts').map(script => {
  const platform = script.replace('-script.ts', '');
  const fileName = script.replace('.ts', '.js');
  return '    \'' + platform + '\': () => import(\'./' + fileName + '\').then(m => m.default || m)';
}).join(',\n') + '\n  };\n  \n  const loader = scriptMap[platform];\n  if (!loader) {\n    return Promise.reject(new Error(\'Unknown platform: \' + platform));\n  }\n  \n  return loader();\n}\n';
  
  const indexPath = path.resolve(outputDir, 'index.js');
  fs.writeFileSync(indexPath, indexContent, 'utf8');
  console.log('✅ Created index.js');
}

// Main build function
async function buildAutonomousScripts() {
  console.log('🚀 Building autonomous platform scripts...');
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log('📁 Created output directory: ' + outputDir);
  }
  
  let successCount = 0;
  let totalCount = PLATFORM_SCRIPTS.length;
  
  // Process each script
  for (const script of PLATFORM_SCRIPTS) {
    const success = await processScript(script);
    if (success) successCount++;
  }
  
  // Create index file
  createIndexFile();
  
  // Report results
  console.log('\n📊 Build Summary:');
  console.log('✅ Successfully built: ' + successCount + '/' + totalCount + ' scripts');
  console.log('📁 Output directory: ' + outputDir);
  
  if (successCount === totalCount) {
    console.log('🎉 All autonomous scripts built successfully!');
  } else {
    console.log('⚠️ ' + (totalCount - successCount) + ' scripts failed to build');
    process.exit(1);
  }
}

// Run the build
buildAutonomousScripts().catch(e => {
  console.error('❌ Build failed:', e);
  process.exit(1);
});