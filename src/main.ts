import { MarkdownView, Notice, Platform, Plugin, TFile, WorkspaceLeaf, normalizePath } from 'obsidian';
import { ConvertResult, convertFileToWechat } from './converter';
import { DEFAULT_SETTINGS, MarkNiceSettingTab, MarkNiceSettings } from './settings';
import { PREVIEW_VIEW_TYPE, WechatPreviewView } from './preview-view';
import { PublishModal } from './publish-modal';
import { WechatTheme, getTheme } from './themes';
import { createWordDocumentBlob, docxArrayBufferToMarkdown } from './word';
import { buildPrintableHtml, createPdfArrayBuffer } from './pdf';

const DOCX_ACCEPT = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function sanitizeFileBaseName(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled';
}

export default class MarkNicePlugin extends Plugin {
  settings: MarkNiceSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(PREVIEW_VIEW_TYPE, (leaf) => new WechatPreviewView(leaf, this));

    this.addRibbonIcon('newspaper', 'MarkNice：公众号排版预览', () => void this.openPreview());

    this.addCommand({
      id: 'open-preview',
      name: '打开公众号排版预览',
      callback: () => void this.openPreview(),
    });

    this.addCommand({
      id: 'copy-as-wechat',
      name: '复制到公众号',
      checkCallback: (checking) => {
        const file = this.getActiveMarkdownFile();
        if (!file) return false;
        if (!checking) void this.copyAsWechat(file);
        return true;
      },
    });

    this.addCommand({
      id: 'copy-current-markdown',
      name: '复制当前笔记 Markdown',
      checkCallback: (checking) => {
        const file = this.getActiveMarkdownFile();
        if (!file) return false;
        if (!checking) void this.copyMarkdown(file);
        return true;
      },
    });

    this.addCommand({
      id: 'publish-to-draft',
      name: '发公众号草稿',
      checkCallback: (checking) => {
        const file = this.getActiveMarkdownFile();
        if (!file) return false;
        if (!checking) void this.openPublishModal(file);
        return true;
      },
    });

    this.addCommand({
      id: 'import-word-document',
      name: '导入 Word 文档为 Markdown',
      callback: () => void this.importWordDocument(),
    });

    this.addCommand({
      id: 'export-word-document',
      name: '导出当前笔记为 Word 文档',
      checkCallback: (checking) => {
        const file = this.getActiveMarkdownFile();
        if (!file) return false;
        if (!checking) void this.exportWordDocument(file);
        return true;
      },
    });

    this.addCommand({
      id: 'export-html-document',
      name: '另存当前笔记为 HTML',
      checkCallback: (checking) => {
        const file = this.getActiveMarkdownFile();
        if (!file) return false;
        if (!checking) void this.exportHtmlDocument(file);
        return true;
      },
    });

    this.addCommand({
      id: 'export-pdf-document',
      name: '导出当前笔记为 PDF',
      checkCallback: (checking) => {
        const file = this.getActiveMarkdownFile();
        if (!file) return false;
        if (!checking) void this.exportPdfDocument(file);
        return true;
      },
    });

    this.addSettingTab(new MarkNiceSettingTab(this.app, this));
  }

  onunload(): void {
    // 视图由 Obsidian 负责回收，不在卸载时 detach，避免影响用户布局
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    let migrated = false;
    if (this.settings.defaultTheme === 'default') {
      this.settings.defaultTheme = 'simple';
      migrated = true;
    }
    if (this.settings.defaultTheme === 'tech') {
      this.settings.defaultTheme = 'night';
      migrated = true;
    }
    if (this.settings.defaultTheme === 'edu') {
      this.settings.defaultTheme = 'green';
      migrated = true;
    }
    if (migrated) await this.saveSettings();
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  getCurrentTheme(): WechatTheme {
    return getTheme(this.settings.defaultTheme);
  }

  getActiveMarkdownFile(): TFile | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view?.file) return view.file;
    const file = this.app.workspace.getActiveFile();
    return file && file.extension === 'md' ? file : null;
  }

  async convert(file: TFile): Promise<ConvertResult> {
    return convertFileToWechat(this.app, file, {
      theme: this.getCurrentTheme(),
      includeTitleInBody: this.settings.includeTitleInBody,
      fontSizeOffset: this.settings.fontSizeOffset,
      paraSpacingOffset: this.settings.paraSpacingOffset,
    });
  }

  /** 复制为带格式的剪贴板内容（text/html + text/plain） */
  async copyAsWechat(file: TFile): Promise<void> {
    try {
      const result = await this.convert(file);
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        const item = new ClipboardItem({
          'text/html': new Blob([result.html], { type: 'text/html' }),
          'text/plain': new Blob([result.plainText], { type: 'text/plain' }),
        });
        await navigator.clipboard.write([item]);
        new Notice(`✅ 已复制「${result.title}」\n到公众号编辑器中直接粘贴即可，排版保持不变。`, 5000);
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(result.plainText);
        new Notice('当前移动端系统剪贴板不支持复制富文本，已改为复制纯文本。', 5000);
        return;
      }

      throw new Error('当前设备不支持剪贴板写入');
    } catch (err) {
      console.error('[MarkNice WeChat] copy failed', err);
      new Notice(`复制失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async copyMarkdown(file: TFile): Promise<void> {
    try {
      const markdown = await this.getMarkdownContent(file);
      if (!navigator.clipboard?.writeText) throw new Error('当前设备不支持文本剪贴板写入');
      await navigator.clipboard.writeText(markdown);
      new Notice(`已复制 Markdown：${file.basename}`, 3000);
    } catch (err) {
      console.error('[MarkNice WeChat] copy Markdown failed', err);
      new Notice(`复制 Markdown 失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async openPublishModal(file: TFile): Promise<void> {
    if (!this.settings.appId || !this.settings.appSecret) {
      new Notice('请先在「设置 → MarkNice WeChat」中填写 App ID 与 App Secret');
      return;
    }
    try {
      const result = await this.convert(file);
      new PublishModal(this.app, this, file, result).open();
    } catch (err) {
      console.error('[MarkNice WeChat] convert failed', err);
      new Notice(`转换失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async importWordDocument(): Promise<void> {
    const picked = await this.pickWordFile();
    if (!picked) return;

    try {
      new Notice('正在导入 Word 文档...');
      const markdown = await docxArrayBufferToMarkdown(await picked.arrayBuffer());
      const folder = this.getActiveFolderPath();
      const path = this.getAvailableVaultPath(folder, sanitizeFileBaseName(picked.name), 'md');
      const created = await this.app.vault.create(path, markdown);
      await this.app.workspace.getLeaf(true).openFile(created);
      new Notice(`已导入 Word 文档：${created.path}`);
      await this.openPreview();
    } catch (err) {
      console.error('[MarkNice WeChat] import Word failed', err);
      new Notice(`导入 Word 失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async exportWordDocument(file: TFile): Promise<void> {
    try {
      new Notice('正在生成 Word 文档...');
      const result = await this.convert(file);
      const blob = await createWordDocumentBlob(result.html, result.title);
      const folder = file.parent?.path ?? '';
      const path = this.getAvailableVaultPath(folder, sanitizeFileBaseName(file.basename), 'docx');
      const created = await this.app.vault.createBinary(path, await blob.arrayBuffer());
      new Notice(`已导出 Word 文档：${created.path}`);
    } catch (err) {
      console.error('[MarkNice WeChat] export Word failed', err);
      new Notice(`导出 Word 失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async exportHtmlDocument(file: TFile): Promise<void> {
    try {
      new Notice('正在生成 HTML 文件...');
      const result = await this.convert(file);
      const html = buildPrintableHtml(result.html, result.title);
      const folder = file.parent?.path ?? '';
      const path = this.getAvailableVaultPath(folder, sanitizeFileBaseName(file.basename), 'html');
      const created = await this.app.vault.create(path, html);
      new Notice(`已另存 HTML：${created.path}`);
    } catch (err) {
      console.error('[MarkNice WeChat] export HTML failed', err);
      new Notice(`另存 HTML 失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async exportPdfDocument(file: TFile): Promise<void> {
    if (Platform.isMobile) {
      new Notice('导出 PDF 仅支持桌面端，请在电脑上使用该功能。');
      return;
    }
    try {
      new Notice('正在生成 PDF 文档...');
      const result = await this.convert(file);
      const pdf = await createPdfArrayBuffer(result.html, result.title);
      const folder = file.parent?.path ?? '';
      const path = this.getAvailableVaultPath(folder, sanitizeFileBaseName(file.basename), 'pdf');
      const created = await this.app.vault.createBinary(path, pdf);
      new Notice(`已导出 PDF 文档：${created.path}`);
    } catch (err) {
      console.error('[MarkNice WeChat] export PDF failed', err);
      new Notice(`导出 PDF 失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private pickWordFile(): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = DOCX_ACCEPT;
      input.classList.add('mn-file-input-hidden');
      let finished = false;

      const finish = (file: File | null): void => {
        if (finished) return;
        finished = true;
        input.remove();
        resolve(file);
      };

      input.addEventListener('change', () => finish(input.files?.[0] ?? null), { once: true });
      input.addEventListener('cancel', () => finish(null), { once: true });
      document.body.appendChild(input);
      input.click();
    });
  }

  private async getMarkdownContent(file: TFile): Promise<string> {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView?.file === file) return activeView.editor.getValue();

    const openViews: MarkdownView[] = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView && leaf.view.file === file) openViews.push(leaf.view);
    });
    const openView = openViews[0];
    if (openView) return openView.editor.getValue();

    return this.app.vault.cachedRead(file);
  }

  private getActiveFolderPath(): string {
    const file = this.getActiveMarkdownFile() ?? this.app.workspace.getActiveFile();
    return file?.parent?.path ?? '';
  }

  private getAvailableVaultPath(folder: string, baseName: string, extension: string): string {
    const safeBase = sanitizeFileBaseName(baseName);
    const prefix = folder ? `${folder}/` : '';
    let candidate = normalizePath(`${prefix}${safeBase}.${extension}`);
    let index = 2;
    while (this.app.vault.getAbstractFileByPath(candidate)) {
      candidate = normalizePath(`${prefix}${safeBase} ${index}.${extension}`);
      index++;
    }
    return candidate;
  }

  async openPreview(): Promise<void> {
    try {
      await this.activatePreview();
    } catch (err) {
      console.error('[MarkNice WeChat] open preview failed', err);
      new Notice(`打开 MarkNice 预览失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async activatePreview(): Promise<void> {
    const file = this.getActiveMarkdownFile();
    const existing = this.app.workspace.getLeavesOfType(PREVIEW_VIEW_TYPE);
    let leaf: WorkspaceLeaf | null = existing[0] ?? null;
    if (!leaf) {
      leaf = Platform.isMobile
        ? this.app.workspace.getLeaf('tab')
        : this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf('split', 'vertical');
      if (!leaf) {
        new Notice('无法打开 MarkNice 预览视图');
        return;
      }
      await leaf.setViewState({ type: PREVIEW_VIEW_TYPE, active: true });
    } else {
      // 面板已存在时，确保它可见。
      await leaf.setViewState({ type: PREVIEW_VIEW_TYPE, active: true });
    }
    await this.revealLeaf(leaf);

    const view = leaf.view;
    if (file && view instanceof WechatPreviewView) view.setFile(file);
  }

  private async revealLeaf(leaf: WorkspaceLeaf): Promise<void> {
    if (!Platform.isMobile && this.app.workspace.rightSplit.collapsed) {
      this.app.workspace.rightSplit.expand();
    }
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
  }

  refreshPreview(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(PREVIEW_VIEW_TYPE)) {
      const view = leaf.view;
      if (view instanceof WechatPreviewView) view.refresh();
    }
  }
}
