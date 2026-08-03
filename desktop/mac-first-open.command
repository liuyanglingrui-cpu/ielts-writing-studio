#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_PATH="$SCRIPT_DIR/IELTS Writing Studio.app"

show_error() {
  /usr/bin/osascript -e "display alert \"IELTS Writing Studio 无法启动\" message \"$1\" as critical"
  exit 1
}

if [ ! -d "$APP_PATH" ]; then
  show_error "请不要单独移动应用。首次打开脚本必须和 IELTS Writing Studio.app 放在同一个文件夹。"
fi

# Files downloaded from the internet receive a quarantine attribute. This
# unsigned classroom build cannot be notarized without an Apple Developer ID,
# so clear quarantine only for this exact app bundle and apply an ad-hoc local
# signature before launching it.
/usr/bin/xattr -dr com.apple.quarantine "$APP_PATH" 2>/dev/null || true
/usr/bin/codesign --force --deep --sign - "$APP_PATH" || show_error "本机签名失败，请联系程序提供者。"
/usr/bin/codesign --verify --deep --strict "$APP_PATH" || show_error "应用完整性检查失败，请重新下载修复包。"

/usr/bin/open "$APP_PATH"
/usr/bin/osascript -e 'display notification "以后可以直接双击应用打开" with title "IELTS Writing Studio 已准备完成"'

