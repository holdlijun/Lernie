# Lernie – 智能英语学习助手

Lernie 是一款专为沉浸式英文阅读设计的 Chrome 浏览器扩展。它提供划词取词、中文释义、语音发音、语境记录，并支持一键同步至 Notion 生词库，帮助你在浏览网页时快速积累词汇。

---

## 功能亮点
- **划词释义**：选中文字后立即弹出卡片，展示词性、中文解释、音标。
- **语境记录**：自动捕获原句上下文，便于回顾学习场景。
- **发音支持**：使用浏览器 `speechSynthesis`，可手动或自动播放发音。
- **Notion 同步**：保存单词、释义、语境、来源链接等信息到指定数据库。
- **多种触发方式**：浮动按钮、快捷键（Alt+T）、右键菜单。
- **自动化选项**：支持自动播放、自动保存、翻译源切换等个性化设置。

---

## 安装方式

### 方式一：通过 Git 克隆安装（适合开发者）
1. 克隆仓库并进入目录：
   ```bash
   git clone git@github.com:holdlijun/WrodMate.git
   cd WrodMate
   ```
2. 打开 Chrome，访问 `chrome://extensions/`。
3. 开启右上角“开发者模式”。
4. 点击“加载已解压的扩展程序”，选择克隆下来的项目目录。
5. 刷新需要使用 Lernie 的网页，使最新内容脚本生效。

### 方式二：通过 Release 安装（适合普通用户）
1. 访问 [Releases 页面](https://github.com/holdlijun/WrodMate/releases)。
2. 下载最新版本的压缩包（例如 `Lernie-0.1.1.zip`）。
3. 解压压缩包，记住解压后的目录位置。
4. 打开 `chrome://extensions/`，开启“开发者模式”。
5. 点击“加载已解压的扩展程序”，选择解压出的文件夹即可。

> 备注：出现 “CRX_HEADER_INVALID” 等报错通常是直接加载 `.crx` 文件导致，请务必先解压或使用 Git clone 的目录。

---

## Notion 集成准备
1. **创建或选择数据库**  
   建议设置以下字段（字段名需与代码匹配，可根据需要增删）：

   | 字段名称    | 类型       | 说明                           |
   | ----------- | ---------- | ------------------------------ |
   | Word        | Title      | 单词本身                       |
   | Meaning     | Rich Text  | 释义（包含词性）              |
   | Phonetic    | Rich Text  | 音标                           |
   | Context     | Rich Text  | 语境原文或翻译                 |
   | Source      | URL        | 来源网页链接                   |
   | SourceTitle | Rich Text  | 页面标题                       |
   | Created     | Date       | 保存时间（由扩展自动写入）     |
   | Status *(可选)* | Status | 学习进度或标签                 |

2. **创建 Notion 集成**  
   - 前往 [Notion Integrations](https://www.notion.so/my-integrations)，创建 Internal Integration。
   - 复制生成的 **Internal Integration Token**，稍后在扩展设置页填写。

3. **授权数据库访问**  
   - 打开数据库页面 → `Share` → `Invite`。
   - 搜索刚创建的集成，授予 `Can edit` 权限。

4. **在 Lernie 中配置**  
   - 打开扩展图标 → `⚙ 设置`，填写：
     - `Notion API Token`（即上一步获取的 Token）。
     - `Database ID`（数据库链接中 `/` 与 `?` 之间的部分，去掉破折号也可）。
   - 点击“测试连接”确认配置有效。
   - 根据需要开启“自动保存到 Notion”等选项。

---

## 使用指南

### 划词与释义
1. 在任意网页选中英文单词或短语。
2. 点击浮动按钮或按 `Alt + T` 打开 Lernie 面板。
3. 面板默认位于浏览器中央，可拖拽并通过 📌 固定位置。

### 发音与语境
- 点击 `🔊` 播放发音；在设置中可启用自动播放。
- 面板会展示词性与多条中文释义，语境页可查看当前句子及翻译。

### 保存到 Notion
- 点击“保存生词库”即可写入数据库。
- 未配置 Notion 时会提示先完成设置；配置后可开启自动保存。
- 保存成功会在面板底部弹出提示。

### 历史记录
- 浏览器工具栏点击扩展图标，可查看最近保存的单词。
- 支持刷新列表、导出 CSV、跳转到 Notion 页面（若已实现相关功能）。

---

## 选项页说明
- **Notion API Token / Database ID**：Notion 授权必填项。
- **默认翻译服务**：当前默认使用 Google；如添加 GPT 支持，可在此切换。
- **自动播放发音**：每次查询完成后自动朗读。
- **自动保存到 Notion**：无需手动点击保存按钮。
- **测试连接**：验证当前 Token 与 Database ID 是否有效。

---

## 常见问题
### 面板没有出现？
- 确保扩展已加载，并刷新需要取词的页面。
- 某些特殊页面（如 PDF、特定 iframe）可能不支持，需要在主页面使用。

### 提示 “Extension context invalidated”？
- Chrome 更新扩展后旧脚本会失效。刷新页面或重新打开标签页即可恢复。

### Notion 同步失败？
- 检查 Token、Database ID 是否填写正确。
- 确认数据库已共享给集成，字段名与代码一致。
- 在 DevTools Console 搜索 `[Lernie]` 查看具体错误信息。

### 释义为空或不完整？
- Google 词典可能偶尔返回空数据，可稍后重试。
- 如需扩展词典来源，可修改 `utils/translation.js`。

---

## 调试与日志
- 页面调试：打开 DevTools → Console，过滤 `[Lernie]` 查看日志。
- 内容脚本：DevTools → Sources → Content scripts → `content.js`。
- Service Worker：`chrome://extensions/` → 点击 Lernie 卡片 → “service worker”。

---

## 版本发布建议
1. 在 `main` 分支完成测试，更新 `manifest.json` 的 `version`。
2. 创建 Git Tag：`git tag v0.x.x && git push origin v0.x.x`。
3. GitHub → `Releases` → `Draft a new release`，选择该 Tag。
4. 上传打包好的 zip（仅包含扩展文件），撰写 Release Note，发布即可。

---

## 目录结构
```
assets/            # 图标与静态资源
styles/            # 样式文件（含 content.css、popup.css）
utils/             # 工具模块（翻译、存储、Notion API 等）
background.js      # MV3 Service Worker
content.js         # 内容脚本，负责页面 UI 与交互
options.html/js    # 设置页面
popup.html/js      # 工具栏弹出页
manifest.json      # Chrome 扩展清单
```

---

如在使用过程中遇到问题或有改进建议，欢迎在 GitHub Issue 中反馈或提交 PR。祝学习愉快！
