import { ItemView, TFile, WorkspaceLeaf, debounce, setIcon } from 'obsidian';
import type MarkNicePlugin from './main';
import { THEMES } from './themes';

export const PREVIEW_VIEW_TYPE = 'marknice-wechat-preview';

export class WechatPreviewView extends ItemView {
  private file: TFile | null = null;
  private paperEl!: HTMLElement;
  private fileNameEl!: HTMLElement;
  private themeSelectEl!: HTMLSelectElement;
  private requestRender = debounce(() => void this.render(), 400, true);

  constructor(leaf: WorkspaceLeaf, private plugin: MarkNicePlugin) {
    super(leaf);
  }

  getViewType(): string {
    return PREVIEW_VIEW_TYPE;
  }

  getDisplayText(): string {
    return '公众号排版预览';
  }

  getIcon(): string {
    return 'newspaper';
  }

  async onOpen(): Promise<void> {
    const root = this.contentEl;
    root.empty();
    root.addClass('mn-view');

    // ---- 顶部工具栏 ----
    const header = root.createDiv({ cls: 'mn-header' });

    const titleRow = header.createDiv({ cls: 'mn-header-title-row' });
    titleRow.createDiv({ cls: 'mn-brand', text: '公众号排版' });
    this.fileNameEl = titleRow.createDiv({ cls: 'mn-filename', text: '未选择文档' });

    const toolbar = header.createDiv({ cls: 'mn-toolbar' });

    const themeWrap = toolbar.createDiv({ cls: 'mn-theme-wrap' });
    themeWrap.createSpan({ cls: 'mn-theme-label', text: '主题' });
    this.themeSelectEl = themeWrap.createEl('select', { cls: 'dropdown mn-theme-select' });
    for (const theme of Object.values(THEMES)) {
      this.themeSelectEl.createEl('option', { value: theme.id, text: theme.label });
    }
    this.themeSelectEl.value = this.plugin.settings.defaultTheme;
    this.themeSelectEl.addEventListener('change', async () => {
      this.plugin.settings.defaultTheme = this.themeSelectEl.value;
      await this.plugin.saveSettings();
      void this.render();
    });

    const actions = toolbar.createDiv({ cls: 'mn-actions' });
    this.makeButton(actions, 'copy', '复制', 'mn-btn', () => {
      if (this.file) void this.plugin.copyAsWechat(this.file);
    });
    this.makeButton(actions, 'send', '发草稿', 'mn-btn mn-btn-primary', () => {
      if (this.file) void this.plugin.openPublishModal(this.file);
    });

    // ---- 预览纸面 ----
    const scroller = root.createDiv({ cls: 'mn-scroller' });
    this.paperEl = scroller.createDiv({ cls: 'mn-paper' });

    // 跟随活动文档
    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        if (file && file.extension === 'md') {
          this.file = file;
          this.requestRender();
        }
      })
    );
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file === this.file) this.requestRender();
      })
    );

    this.file = this.plugin.getActiveMarkdownFile();
    await this.render();
  }

  private makeButton(
    parent: HTMLElement,
    icon: string,
    label: string,
    cls: string,
    onClick: () => void
  ): HTMLButtonElement {
    const btn = parent.createEl('button', { cls });
    const iconEl = btn.createSpan({ cls: 'mn-btn-icon' });
    setIcon(iconEl, icon);
    btn.createSpan({ text: label });
    btn.addEventListener('click', onClick);
    return btn;
  }

  setFile(file: TFile): void {
    this.file = file;
    this.requestRender();
  }

  refresh(): void {
    this.themeSelectEl.value = this.plugin.settings.defaultTheme;
    this.requestRender();
  }

  private async render(): Promise<void> {
    if (!this.file) {
      this.fileNameEl.setText('未选择文档');
      this.paperEl.empty();
      const empty = this.paperEl.createDiv({ cls: 'mn-empty' });
      empty.createDiv({ cls: 'mn-empty-icon', text: '✺' });
      empty.createDiv({ text: '打开一篇 Markdown 笔记即可预览公众号排版' });
      return;
    }

    this.fileNameEl.setText(this.file.basename);
    try {
      const result = await this.plugin.convert(this.file);
      this.paperEl.empty();
      // 转换结果全部为内联样式，直接注入即可与公众号编辑器一致
      this.paperEl.innerHTML = result.html;
    } catch (err) {
      this.paperEl.empty();
      this.paperEl.createDiv({
        cls: 'mn-empty',
        text: `转换失败：${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }
}
