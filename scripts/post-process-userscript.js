#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildType = process.argv[2] || 'build:userscript';

function getUserscriptHeader(minified = false) {
  const version = getPackageVersion();
  const minSuffix = minified ? ' (Minified)' : '';
  
  return `// ==UserScript==
// @name         表情扩展 (Emoji Extension)${minSuffix}
// @namespace    https://github.com/stevessr/bug-v3
// @version      ${version}
// @description  为论坛网站添加表情选择器功能 (Add emoji picker functionality to forum websites)
// @author       stevessr
// @match        https://linux.do/*
// @match        https://meta.discourse.org/*
// @match        https://*.discourse.org/*
// @grant        none
// @license      MIT
// @homepageURL  https://github.com/stevessr/bug-v3
// @supportURL   https://github.com/stevessr/bug-v3/issues
// @downloadURL  https://github.com/stevessr/bug-v3/releases/latest/download/emoji-extension${minified ? '-min' : ''}.user.js
// @updateURL    https://github.com/stevessr/bug-v3/releases/latest/download/emoji-extension${minified ? '-min' : ''}.user.js
// @run-at       document-end
// ==/UserScript==

(function() {
'use strict';

`;
}

function getUserscriptFooter() {
  return `
})();`;
}

function getPackageVersion() {
  try {
    const packagePath = path.resolve(__dirname, '..', 'package.json');
    const packageData = fs.readFileSync(packagePath, 'utf8');
    const packageJson = JSON.parse(packageData);
    return packageJson.version || '1.0.0';
  } catch (error) {
    console.warn('Could not read package version, using default');
    return '1.0.0';
  }
}

function processUserscript() {
  const isMinified = buildType === 'build:userscript:min';
  const inputDir = isMinified ? 'dist-userscript-min' : 'dist-userscript';
  const outputDir = 'dist';
  const inputFile = path.resolve(__dirname, '..', inputDir, 'userscript.js');
  const outputFile = path.resolve(__dirname, '..', outputDir, `emoji-extension${isMinified ? '-min' : ''}.user.js`);

  try {
    console.log(`📦 Processing ${isMinified ? 'minified' : 'standard'} userscript...`);
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Read the built userscript
    if (!fs.existsSync(inputFile)) {
      throw new Error(`Input file not found: ${inputFile}`);
    }

    const userscriptContent = fs.readFileSync(inputFile, 'utf8');
    
    // Combine header + content + footer
    const header = getUserscriptHeader(isMinified);
    const footer = getUserscriptFooter();
    const finalContent = header + userscriptContent + footer;

    // Write the final userscript
    fs.writeFileSync(outputFile, finalContent, 'utf8');
    
    const stats = fs.statSync(outputFile);
    const sizeKB = (stats.size / 1024).toFixed(2);
    
    console.log(`✅ Created ${isMinified ? 'minified' : 'standard'} userscript: ${outputFile}`);
    console.log(`📊 File size: ${sizeKB} KB`);
    
    // Clean up temporary build directory
    try {
      fs.rmSync(path.resolve(__dirname, '..', inputDir), { recursive: true, force: true });
      console.log(`🧹 Cleaned up temporary directory: ${inputDir}`);
    } catch (cleanupError) {
      console.warn(`⚠️  Could not clean up ${inputDir}:`, cleanupError.message);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to process userscript:', error.message);
    return false;
  }
}

function main() {
  console.log(`🔧 Post-processing userscript build: ${buildType}`);
  
  const success = processUserscript();
  process.exit(success ? 0 : 1);
}

main();