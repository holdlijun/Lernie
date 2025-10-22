# WordMate Chrome Extension 

## 项目概览
WordMate 是一款面向英文内容阅读场景的 Chrome 拓展，支持划词翻译、发音、语境理解以及一键保存生词到本地历史和 Notion 数据库，帮助构建个人英语词汇体系。

## 功能特性
- **划词取词**：在网页上选中英文单词后自动弹出面板展示中文释义、音标、语境翻译与语法提示。
- **即时发音**：内置发音按钮，支持通过浏览器语音合成朗读单词。
- **生词管理**：保存在地历史记录，可查看最近 10 条并导出 CSV。
- **Notion 同步**：配置后可将单词、释义、音标、语境等信息同步到指定 Notion 数据库。
- **快捷操作**：支持悬浮按钮、右键菜单、快捷键（Alt+T 打开面板、Shift+P 播放发音、Ctrl+Shift+S 同步 Notion）。

## 安装与运行
1. 克隆项目：
   ```bash
   git clone git@github.com:holdlijun/WrodMate.git
   cd WrodMate
   ```
2. 打开 Chrome，访问 `chrome://extensions/`，开启右上角的 **开发者模式**。
3. 点击 “加载已解压的扩展程序”，选择项目根目录。扩展加载后，如需更新请点击 “重新加载”。
4. 在已打开的网页中，刷新标签页以注入最新内容脚本。

## Notion 集成配置
1. 登录 [Notion](https://www.notion.so) 并创建数据库（建议使用表格视图）。需要的属性如下：
   | 属性名称 | 类型 | 说明 |
   | -------- | ---- | ---- |
   | Word | Title | 单词本身 |
   | Meaning | Rich Text | 中文释义（包含各词性） |
   | Phonetic | Rich Text | 音标（多音标时用换行分隔） |
   | Examples | Rich Text | 例句（当前版本为预设模板） |
   | Context | Rich Text | 划词所在语境与译文 |
   | Source | URL | 拾取生词的网页链接 |
   | SourceTitle | Rich Text | 页面标题 |
   | Created | Date | 创建时间（自动生成） |
   | Status *(可选)* | Status | 生词学习状态 |

2. 创建 Notion 集成：在 Notion 设置中打开 **Integrations**，创建一个新的 Internal Integration，记录生成的 **Internal Integration Token**。
3. 将数据库页面分享给该集成（Share → Invite → 搜索集成名称 → 赋予 `Can edit` 权限）。
4. 在扩展 `options.html` 设置页中填写：
   - **Notion API Token**：上一步得到的 Integration Token。
   - **Database ID**：数据库链接中 `https://www.notion.so/<workspace>/<database-id>?...` 的 ID （去掉破折号也可）。
   - 点击 “测试连接” 验证，成功后可开启 “划词后自动保存到生词库” 等选项。

## 使用指南
- **划词取词**：选中单词后点击悬浮 `W` 按钮或按 `Alt+T` 打开面板。
- **面板操作**：
  - 📌 按钮可固定面板位置，再次点击取消固定。
  - 🔊 按钮播放发音。
  - “保存生词库” 将单词写入本地历史；若已配置 Notion，手动或自动同步时会将该条目写入数据库。
- **历史记录**：点击扩展图标查看最近保存的词条，可导出 CSV 或跳转到 Notion。
- **设置页**：
  - 选择翻译提供方（当前默认 Google；GPT 模式暂为占位）。
  - 可配置是否自动播放发音、自动保存到 Notion、OpenAI API Key 和模型等参数。

## 常见问题
- **发音/翻译失败**：确认网络可访问 Google Translate/Speech 服务，必要时刷新页面后重试。
- **Notion 同步失败**：
  1. 确认 Token 和 Database ID 填写正确；
  2. 确保数据库已分享给集成且字段名称匹配；
  3. 若失败记录会进入重试队列，稍后会再次尝试同步。
- **面板未出现**：检查是否刷新了当前页面、是否有其他划词插件冲突。
- **编码导致扩展无法加载**：所有脚本均为 UTF-8，无需手动修改；若从压缩包安装，请保持文件原始编码。

## 开发与贡献
- 项目为纯前端 MV3 扩展，无构建步骤；修改后在扩展管理页点击 “重新加载” 并刷新网页即可。
- 推荐使用 VS Code 或任何支持 ES2020 的编辑器；如需调试内容脚本，可在 Chrome DevTools → Sources → Content scripts 中定位 `content.js`。
- 欢迎提交 Issue 或 Pull Request 提出改进建议。

## 目录结构
```
├── assets/               # 图标素材
├── styles/               # CSS 样式（content.css）
├── utils/                # 辅助模块（翻译、存储、Notion 等）
├── background.js         # MV3 Service Worker 后台逻辑
├── content.js            # 内容脚本，处理划词与 UI
├── options.html / js     # 设置页面
├── popup.html / js       # 扩展弹窗
└── manifest.json         # Chrome 扩展清单
```

## 许可证
本项目暂未指定许可证，默认保留所有权利。如需使用或商用，请先联系作者。
