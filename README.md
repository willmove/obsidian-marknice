# MarkNice WeChat

MarkNice WeChat 是一个 Obsidian 微信公众号排版插件。它可以把当前 Markdown 笔记转换为适合微信公众号编辑器的内联样式 HTML，并提供实时预览、一键复制、直接发送到公众号草稿箱、Word 导入导出、PDF 导出等能力。

- 当前版本：`0.6.5`
- 最低 Obsidian 版本：`1.5.0`

## 功能特性

- **公众号排版预览**：在 Obsidian 中打开右侧预览面板，按最终公众号样式渲染当前笔记，编辑后自动刷新。
- **桌面 / 手机预览模式**：支持桌面宽度预览，也支持 375px 手机视图，便于检查移动端阅读效果。
- **16 套排版主题**：内置 Claude 暖陶、经典蓝、杂志衬线、极简黑白、靛粉渐变、极客深色、优雅棕、活力红、琥珀橙、清新绿、健康绿、杂志红、复古纸、夜空蓝、梦幻紫、海盐青。
- **字号与段距微调**：可在主题默认样式基础上调整字号和段落间距，设置会同步影响预览、复制和发草稿。
- **一键复制到公众号编辑器**：复制时写入 `text/html` 和 `text/plain`，样式全部内联到 `style` 属性，粘贴到公众号编辑器后尽量保持排版不变。
- **发送到公众号草稿箱**：通过微信公众号接口上传封面和正文图片，并创建草稿。
- **Word 导入 / 导出与 PDF 导出**：可把 `.docx` 导入为 Markdown，也可把当前笔记导出为 `.docx` 或 `.pdf`。
- **数学公式渲染**：使用 KaTeX 渲染行内公式 `$E=mc^2$` 与块级公式 `$$...$$`。
- **Obsidian 语法适配**：支持图片嵌入、双链降级、高亮、Callout、任务列表、表格、代码块等常见写法。

## 安装

### 从社区插件安装

在 Obsidian 社区插件市场搜索 **MarkNice WeChat**，安装并启用插件。

### 手动安装

1. 在目标库中创建插件目录：

   ```text
   <vault>/.obsidian/plugins/marknice-wechat/
   ```

2. 将以下文件复制到该目录：

   ```text
   main.js
   manifest.json
   styles.css
   ```

3. 在 Obsidian 中进入「设置 -> 第三方插件」，启用 **MarkNice WeChat**。

## 使用方式

### 打开排版预览

可以通过以下任一方式打开预览：

- 点击左侧栏的 **MarkNice: 公众号排版预览** 图标。
- 在命令面板执行 **打开公众号排版预览**。

预览面板会跟随当前打开的 Markdown 文件。顶部工具栏支持切换主题、导入 Word、导出 Word、导出 PDF、复制和发送草稿；第二行工具栏支持调整字号、段距和预览模式。

### 复制为公众号格式

打开 Markdown 笔记后，可以：

- 在预览面板点击 **复制**。
- 或在命令面板执行 **复制为公众号格式（可直接粘贴到草稿编辑器）**。

然后到微信公众号后台编辑器中直接粘贴。桌面端会优先复制富文本 HTML；如果当前环境不支持富文本剪贴板，会退回复制纯文本。

### 发送到公众号草稿箱

发送草稿前，需要先在「设置 -> MarkNice WeChat」中填写：

- **WeChat App ID**
- **WeChat App Secret**

配置完成后，可以在预览面板点击 **发草稿**，或在命令面板执行 **发送到公众号草稿箱**。弹窗中可确认标题、作者、摘要和封面图，随后插件会执行以下流程：

1. 获取微信公众号接口凭证。
2. 上传封面图。
3. 上传正文中的图片并替换为微信图床地址。
4. 创建公众号草稿。

注意事项：

- 微信公众号接口要求将当前出口 IP 加入 **IP 白名单**，否则可能返回 `40164`。
- 草稿箱和素材接口通常要求公众号已认证。
- `AppSecret` 仅保存到当前 Obsidian 库的插件数据中，不会由插件主动上传到第三方服务。
- 封面图为微信草稿必填项，可使用库内图片路径或 `https` 图片链接。

### Word 导入导出与 PDF 导出

- **导入 Word 文档为 Markdown**：选择本地 `.docx` 文件，插件会在当前目录或活动文件所在目录创建对应 Markdown 文件，并自动打开预览。
- **导出当前笔记为 Word 文档**：将当前 Markdown 笔记转换为 `.docx`，文件会保存到当前笔记所在目录，若重名会自动追加序号。
- **导出当前笔记为 PDF 文档**：桌面端会直接生成 `.pdf` 并保存到当前笔记所在目录，若重名会自动追加序号，无需打开系统打印对话框。

关于公式导出：Word 的 HTML 导入链路无法稳定还原 KaTeX 的排版结构，因此导出 Word 时公式会转换为线性可读文本，例如 `\frac{a+b}{c+d}` 会转换为 `(a+b)/(c+d)`。公众号预览与复制仍使用 KaTeX 渲染后的公式。

## Frontmatter

插件会读取笔记 frontmatter，用于预填发布弹窗：

```yaml
---
title: 文章标题        # 缺省使用文件名
author: 作者名         # 缺省使用插件设置中的默认作者
digest: 分享摘要       # 也支持 description；缺省截取正文开头
cover: assets/cover.png # 库内图片路径或 https 图片链接
---
```

字段说明：

| 字段 | 用途 | 备注 |
| --- | --- | --- |
| `title` | 公众号草稿标题 | 最多 64 个字符 |
| `author` | 作者 | frontmatter 优先于插件默认作者 |
| `digest` | 分享摘要 | 最多 120 字 |
| `description` | 分享摘要 | 当 `digest` 不存在时作为备选 |
| `cover` | 封面图 | 支持库内路径或远程图片 URL |

## 支持的 Markdown 与 Obsidian 语法

| 类型 | 支持情况 |
| --- | --- |
| 标题、段落、列表、引用、分隔线 | 支持并转换为内联样式 |
| 表格 | 支持基础表格样式 |
| 代码块、行内代码 | 支持，代码块会保留换行和空格 |
| 加粗、斜体、删除线 | 支持 |
| `==高亮==` | 转换为 `<mark>` |
| `![[图片.png]]` | 解析为库内图片并转换为 data URL |
| `[[双链]]` | 降级为纯文本 |
| Callout | 按引用块样式处理，并强化标题行 |
| 任务列表 | 复选框会转换为文本符号 |
| 行内公式 `$...$` | 使用 KaTeX 渲染 |
| 块级公式 `$$...$$` | 使用 KaTeX 渲染 |

## 图片处理

- 复制到公众号编辑器时，库内图片会转为 data URL，粘贴后由公众号编辑器自行处理。
- 发送草稿时，封面图会通过临时素材接口上传，正文图片会逐张上传到微信并替换为微信图床地址。
- 支持常见图片格式：`png`、`jpg`、`jpeg`、`gif`、`webp`、`bmp`、`svg`。
- 发布草稿选择封面时，库内选择器会排除 `svg`，以避免微信封面接口兼容性问题。

## 开发

安装依赖：

```bash
npm install
```

开发构建：

```bash
npm run dev
```

生产构建：

```bash
npm run build
```

构建脚本会先执行 TypeScript 类型检查，再通过 esbuild 输出 `main.js`。

## 项目结构

```text
obsidian-marknice/
├── manifest.json          # Obsidian 插件清单
├── main.js                # 构建产物
├── styles.css             # 插件界面样式
├── package.json           # 依赖与脚本
├── versions.json          # Obsidian 插件版本映射
├── docs/                  # 发布说明与社区插件提交材料
└── src/
    ├── main.ts            # 插件入口、命令注册、视图注册
    ├── preview-view.ts    # 公众号排版预览面板
    ├── settings.ts        # 插件设置页
    ├── converter.ts       # Markdown 到公众号 HTML 的转换逻辑
    ├── themes.ts          # 内置排版主题
    ├── math.ts            # 公式解析、渲染与 Word 导出降级
    ├── publish-modal.ts   # 发送草稿弹窗
    ├── wechat-api.ts      # 微信公众号接口客户端
    ├── word.ts            # Word 导入 / 导出
    ├── pdf.ts             # PDF 生成
    ├── docx-parser.ts     # .docx 解析
    ├── html-to-markdown.ts # HTML 到 Markdown 转换
    └── vendor.d.ts        # 第三方库类型声明
```

## 技术栈

- Obsidian Plugin API
- TypeScript
- esbuild
- marked
- KaTeX
- html-docx-js
- JSZip

## 已知限制

- 微信公众号编辑器会过滤部分 HTML、CSS 和交互能力，因此插件会尽量使用内联样式和基础结构保证兼容性。
- 移动端或部分系统环境可能不支持写入富文本剪贴板，此时复制功能会退回纯文本。
- Word 导出中的公式会转换为线性文本，以优先保证内容正确。
- 非图片类型的 Obsidian 嵌入无法在公众号中等价表达，会降级为文本。

## English Summary

MarkNice WeChat is an Obsidian plugin for converting Markdown notes into WeChat Official Account articles. It provides themed formatting, live preview, rich-text copy, direct draft publishing through the WeChat API, Word import/export, KaTeX math rendering, and compatibility handling for common Obsidian syntax.

Manual install: copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/marknice-wechat/`, then enable the plugin in Obsidian.

## License

[MIT](LICENSE)
