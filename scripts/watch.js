#!/usr/bin/env node

// 监视 src 目录的文件变动，触发构建 (使用 scripts/build.js build)
import { spawn } from "child_process";
import { watch } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, "..", "src");
let buildProcess = null;
let pendingRun = false;
let debounceTimer = null;
const DEBOUNCE_MS = 200;

function startBuild() {
  if (buildProcess) {
    // 如果当前有构建在运行，标记为在结束后需要再跑一次
    pendingRun = true;
    return;
  }

  console.log("🔁 触发构建: node scripts/build.js build");
  buildProcess = spawn(
    process.execPath,
    [path.join(__dirname, "build.js"), "build"],
    {
      stdio: "inherit",
      shell: true,
      env: process.env,
    }
  );

  buildProcess.on("exit", (code) => {
    buildProcess = null;
    console.log(`构建结束，退出码: ${code}`);
    if (pendingRun) {
      pendingRun = false;
      // 小延迟以合并紧接的文件改动
      setTimeout(startBuild, 50);
    }
  });
}

console.log(`👀 正在监视: ${srcDir}（递归）`);

try {
  const watcher = watch(srcDir, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    // 忽略临时/隐藏文件的噪声
    if (filename.startsWith(".") || filename.endsWith("~")) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => startBuild(), DEBOUNCE_MS);
  });

  process.on("SIGINT", () => {
    console.log("\n停止监视，退出。");
    watcher.close();
    process.exit(0);
  });
} catch (err) {
  console.error("无法启动文件监视器:", err);
  console.error("你可以考虑安装 chokidar 并改用更可靠的实现。");
  process.exit(1);
}
