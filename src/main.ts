import { MarkdownView, Notice, Platform, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import { ConvertResult, convertFileToWechat } from './converter';
import { DEFAULT_SETTINGS, MarkNiceSettingTab, MarkNiceSettings } from './settings';
import { PREVIEW_VIEW_TYPE, WechatPreviewView } from './preview-view';
import { PublishModal } from './publish-modal';
import { WechatTheme, getTheme } from './themes';

export default class MarkNicePlugin extends Plugin {
  settings: MarkNiceSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(PREVIEW_VIEW_TYPE, (leaf) => new WechatPreviewView(leaf, this));

    this.addRibbonIcon('newspaper', 'MarkNice：公众号排版预览', () => void this.activatePreview());

    this.addCommand({
      id: 'open-preview',
      name: '打开公众号排版预览',
      callback: () => void this.activatePreview(),
    });

    this.addCommand({
      id: 'copy-as-wechat',
      name: '复制为公众号格式（可直接粘贴到草稿编辑器）',
      checkCallback: (checking) => {
        const file = this.getActiveMarkdownFile();
        if (!file) return false;
        if (!checking) void this.copyAsWechat(file);
        return true;
      },
    });

    this.addCommand({
      id: 'publish-to-draft',
      name: '发送到公众号草稿箱',
      checkCallback: (checking) => {
        const file = this.getActiveMarkdownFile();
        if (!file) return false;
        if (!checking) void this.openPublishModal(file);
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

  async activatePreview(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(PREVIEW_VIEW_TYPE);
    let leaf: WorkspaceLeaf | null = existing[0] ?? null;
    if (!leaf) {
      leaf = Platform.isMobile ? this.app.workspace.getLeaf('tab') : this.app.workspace.getRightLeaf(false);
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

    const file = this.getActiveMarkdownFile();
    const view = leaf.view;
    if (file && view instanceof WechatPreviewView) view.setFile(file);
  }

  private async revealLeaf(leaf: WorkspaceLeaf): Promise<void> {
    const workspace = this.app.workspace as typeof this.app.workspace & {
      revealLeaf?: (leaf: WorkspaceLeaf) => Promise<void>;
    };
    if (workspace.revealLeaf) {
      await workspace.revealLeaf(leaf);
      return;
    }
    this.app.workspace.setActiveLeaf(leaf, false, true);
  }

  refreshPreview(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(PREVIEW_VIEW_TYPE)) {
      const view = leaf.view;
      if (view instanceof WechatPreviewView) view.refresh();
    }
  }
}
