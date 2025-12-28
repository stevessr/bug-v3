#!/bin/bash
# 包装脚本，隐藏 npm 警告

# 设置环境变量来抑制警告
export npm_config_loglevel=warn
export npm_config_audit=false
export npm_config_fund=false

# 运行传入的命令
exec "$@"