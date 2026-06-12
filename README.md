# MarkNice WeChat — Obsidian 公众号排版插件

中文 | [English](#english)

把 Obsidian 笔记一键变成漂亮的微信公众号文章：**多主题排版 → 实时预览 → 一键复制 / 直接发草稿**。

> 本项目由原 OpenClaw Skill（marknice-wechat）重构而来，现在是一个完整的 Obsidian 插件。

## 功能

- **实时预览**：右侧面板按公众号实际效果渲染当前笔记，编辑自动刷新
- **8 套主题**：Claude 暖陶（Anthropic 风格）、经典蓝、杂志衬线、极客深色、优雅棕、活力红、极简黑白、琥珀橙
- **一键复制**：所有样式内联写入 `style` 属性，粘贴进公众号编辑器排版不乱
- **一键发草稿**：直接调用公众号接口创建草稿，自动上传封面与正文图片（本地图、`![[wiki 嵌入]]`、远程图都会转成微信图床链接）
- **Obsidian 语法友好**：支持 `![[图片嵌入]]`、`[[双链]]`（降级为纯文本）、`==高亮==`、Callout、任务列表、表格、代码块

## 安装

手动安装（暂未上架社区市场）：

1. 在你的库中创建目录 `<vault>/.obsidian/plugins/marknice-wechat/`
2. 把 `main.js`、`manifest.json`、`styles.css` 三个文件复制进去
3. 在 Obsidian「设置 → 第三方插件」中启用 **MarkNice WeChat**

从源码构建：

```bash
npm install
npm run build   # 产出 main.js
```

## 使用

### 1. 预览与切换主题

点击左侧栏的 📰 图标，或命令面板执行「**打开公众号排版预览**」。预览面板顶部可随时切换主题。

### 2. 一键复制

预览面板点「复制」，或命令面板执行「**复制为公众号格式**」，然后到公众号编辑器里 `Ctrl/Cmd+V` 直接粘贴。本地图片会内联为 base64，粘贴后由编辑器自动转存。

### 3. 发送到草稿箱

先在「设置 → MarkNice WeChat」填好：

- **WeChat App ID** / **WeChat App Secret**（公众平台 → 设置与开发 → 基本配置）

然后点预览面板的「发草稿」或执行命令「**发送到公众号草稿箱**」。弹窗中确认标题、作者、摘要、封面图（必填，可从库中选图）后发送。流程：获取凭证 → 上传封面 → 逐张上传正文图片 → 创建草稿。

> **注意**
> - 公众号接口要求把你的出口 IP 加入 **IP 白名单**（公众平台 → 基本配置），否则报错 40164。
> - 草稿箱 / 素材接口需要 **已认证** 的公众号。
> - AppSecret 仅保存在本地库的插件数据（`data.json`）中，不会上传。

### Frontmatter 支持

笔记的 frontmatter 字段会自动作为草稿默认值：

```yaml
---
title: 文章标题        # 缺省用文件名
author: 作者名         # 缺省用设置中的默认作者
digest: 分享卡片摘要    # 缺省截取正文开头
cover: assets/封面.png # 库内路径或 https 链接，缺省用文中第一张图
---
```

## 项目结构

```text
marknice-obsidian/
├── manifest.json        # 插件清单
├── main.js              # 构建产物（esbuild 打包）
├── styles.css           # 界面样式（Anthropic 风格）
├── src/
│   ├── main.ts          # 插件入口：命令、视图注册
│   ├── converter.ts     # Markdown → 公众号内联样式 HTML
│   ├── themes.ts        # 8 套排版主题
│   ├── wechat-api.ts    # 公众号接口客户端（token / 上传 / 草稿）
│   ├── preview-view.ts  # 右侧预览面板
│   ├── publish-modal.ts # 发草稿弹窗
│   └── settings.ts      # 设置页
├── esbuild.config.mjs
├── tsconfig.json
└── package.json
```

## License

[MIT](LICENSE)

---

## English

Turn Obsidian notes into polished WeChat Official Account articles: **themed formatting → live preview → one-click copy / direct draft publishing**.

### Features

- **Live preview** panel that renders the active note exactly as it will appear in WeChat, refreshing as you type
- **8 themes**, including a Claude-inspired warm-clay style
- **One-click copy** — every style is inlined into `style` attributes, so pasting into the WeChat editor never breaks the layout
- **Publish to draft box** via the official API: cover and body images (local files, `![[wiki embeds]]`, remote URLs) are uploaded to WeChat hosting automatically
- Handles Obsidian syntax: image embeds, wikilinks (flattened to text), `==highlight==`, callouts, task lists, tables, code blocks

### Install

Manual install: copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/marknice-wechat/`, then enable the plugin. To build from source, run `npm install && npm run build`.

### Setup for publishing

Enter your **App ID** and **App Secret** in the plugin settings (WeChat MP console → Settings & Development → Basic Configuration). Note that the WeChat API requires your IP to be whitelisted, and the draft/material APIs require a verified account. Frontmatter keys `title`, `author`, `digest`, and `cover` pre-fill the publish dialog.
