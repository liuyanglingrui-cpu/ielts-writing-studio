# IELTS Writing Studio

一个用于模拟 IELTS 机考写作界面的本地练习工具。它专注于计时和写作，不提供批改、拼写纠正或自动改写。

## 功能

- Task 1 和 Task 2 均由用户自行添加题目，默认不内置题目
- 可以只练习其中一个 Task
- Task 1 支持创建、编辑和导出数据表格
- 关闭拼写检查与自动纠错
- 自动保存题目、表格、作文和倒计时到本地
- 导出排版清晰的 `.docx`；没有题目的 Task 不会进入文档
- Windows、Apple Silicon Mac 和 Intel Mac 桌面版本

## 下载

请前往 [Releases](https://github.com/liuyanglingrui-cpu/ielts-writing-studio/releases/latest) 下载对应平台的安装包。

- Windows：`IELTS-Writing-Studio-0.2.0-Portable.exe`
- Apple Silicon（M1/M2/M3/M4/M5）：文件名包含 `macOS-arm64-Fixed`
- Intel Mac：文件名包含 `macOS-x64`

macOS 版本目前没有 Apple Developer ID 签名。Apple Silicon 修复包内附“首次打开我.command”；首次运行时按住 Control 点击该文件并选择“打开”，成功后即可直接启动应用。

## 本地开发

需要 Node.js 22 或更高版本。

```bash
npm install
npm run desktop
```

生成 Windows 便携版：

```bash
npm run desktop:pack
```

生成 macOS 架构包：

```bash
python desktop/package-macos.py arm64
python desktop/package-macos.py x64
```

## 数据与隐私

练习内容只保存在用户自己的电脑上。程序不包含联网批改功能，也不会自动上传作文。

Windows 本地数据通常位于：

```text
%APPDATA%\IELTS Writing Studio\writing-practice.json
```

## 项目结构

- `desktop/`：Electron 桌面应用、DOCX 导出器和打包脚本
- `app/`：浏览器版本界面
- `tests/`：网页构建测试

