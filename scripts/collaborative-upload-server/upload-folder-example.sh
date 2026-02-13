#!/bin/bash
# upload-folder.js 使用示例脚本

# 设置颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== upload-folder.js 使用示例 ===${NC}"
echo ""

# 检查是否安装了必要的工具
echo -e "${YELLOW}检查前置要求...${NC}"

# 检查 Node.js
if command -v node &> /dev/null; then
    echo -e "${GREEN}✓${NC} Node.js 已安装: $(node --version)"
else
    echo -e "${RED}✗${NC} Node.js 未安装"
    exit 1
fi

# 图片尺寸检测使用纯 Node.js 实现，无需额外依赖

echo ""
echo -e "${YELLOW}=== 启动服务器 ===${NC}"
echo "在另一个终端中运行以下命令启动协作上传服务器："
echo "  node server.js"
echo ""

# 创建测试文件夹
TEST_DIR="./test-emojis"
if [ ! -d "$TEST_DIR" ]; then
    echo -e "${YELLOW}创建测试文件夹...${NC}"
    mkdir -p "$TEST_DIR"
    echo "测试文件夹已创建: $TEST_DIR"
    echo "请将一些图片文件放入此文件夹中"
    echo ""
fi

# 检查测试文件夹中是否有图片
IMAGE_COUNT=$(find "$TEST_DIR" -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.webp" \) 2>/dev/null | wc -l)

if [ "$IMAGE_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}测试文件夹中没有图片文件${NC}"
    echo "请添加一些图片文件到: $TEST_DIR"
    echo "支持的格式：PNG, JPEG, WebP, GIF, BMP, AVIF"
    echo ""
    echo "按 Enter 键继续（或 Ctrl+C 退出后添加图片）..."
    read
fi

echo -e "${YELLOW}=== 使用示例 ===${NC}"
echo ""

echo "1. 基本用法（流式输出）："
echo "   node upload-folder.js $TEST_DIR \"测试表情\""
echo ""

echo "2. 自定义缩图尺寸："
echo "   node upload-folder.js $TEST_DIR \"测试表情\" --thumbnail 150"
echo ""

echo "3. 非流式输出（保存到文件）："
echo "   node upload-folder.js $TEST_DIR \"测试表情\" --no-stream > output.json"
echo ""

echo "4. 指定服务器地址："
echo "   node upload-folder.js $TEST_DIR \"测试表情\" --server ws://localhost:9527"
echo ""

echo "5. 记录失败日志："
echo "   node upload-folder.js $TEST_DIR \"测试表情\" --log-file failed.log"
echo ""

echo -e "${YELLOW}=== 完整示例（流式输出） ===${NC}"
echo ""
echo "运行以下命令："
echo -e "${GREEN}node upload-folder.js $TEST_DIR \"测试表情\"${NC}"
echo ""

read -p "按 Enter 键运行示例，或 Ctrl+C 退出..."

# 运行示例
node upload-folder.js "$TEST_DIR" "测试表情"

echo ""
echo -e "${GREEN}=== 示例完成 ===${NC}"
echo ""

# 清理测试文件（可选）
read -p "是否删除测试文件夹? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$TEST_DIR"
    echo -e "${GREEN}✓${NC} 测试文件夹已删除"
fi