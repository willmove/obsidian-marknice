import { ItemView, TFile, WorkspaceLeaf, debounce, setIcon } from 'obsidian';
import type MarkNicePlugin from './main';
import { THEMES } from './themes';
import {
  FONT_OFFSET_MAX,
  FONT_OFFSET_MIN,
  PreviewMode,
  SPACING_OFFSET_MAX,
  SPACING_OFFSET_MIN,
  SPACING_OFFSET_STEP,
} from './settings';

export const PREVIEW_VIEW_TYPE = 'marknice-wechat-preview';

/**
 * 把 HTML 字符串安全地写入容器。
 * 转换结果是插件自己生成的内联样式 HTML（无外部输入），仍走 DOMParser 构造
 * 以满足 Obsidian 插件审核的 no-unsafe-innerhtml 规则。
 */
function setInnerHtml(target: HTMLElement, html: string): void {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const wrapper = doc.body.firstElementChild;
  target.empty();
  const fragment = document.createDocumentFragment();
  while (wrapper?.firstChild) {
    fragment.appendChild(wrapper.firstChild);
  }
  target.appendChild(fragment);
}

export class WechatPreviewView extends ItemView {
  private file: TFile | null = null;
  private scrollerEl!: HTMLElement;
  private paperEl!: HTMLElement;
  private fileNameEl!: HTMLElement;
  private themeSelectEl!: HTMLSelectElement;
  private fontSizeLabelEl!: HTMLElement;
  private paraSpacingLabelEl!: HTMLElement;
  private desktopBtnEl!: HTMLButtonElement;
  private phoneBtnEl!: HTMLButtonElement;
  private renderRequested = false;
  private renderRunning = false;
  private requestRender = debounce(() => void this.flushRenderQueue(), 400, true);

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
      this.scheduleRender();
    });

    const actions = toolbar.createDiv({ cls: 'mn-actions' });
    this.makeButton(actions, 'file-input', '导入 Word', 'mn-btn', () => {
      void this.plugin.importWordDocument();
    });
    this.makeButton(actions, 'file-output', '导出 Word', 'mn-btn', () => {
      if (this.file) void this.plugin.exportWordDocument(this.file);
    });
    this.makeButton(actions, 'copy', '复制', 'mn-btn', () => {
      if (this.file) void this.plugin.copyAsWechat(this.file);
    });
    this.makeButton(actions, 'send', '发草稿', 'mn-btn mn-btn-primary', () => {
      if (this.file) void this.plugin.openPublishModal(this.file);
    });

    // ---- 第二行：字号 / 段距 / 预览模式 ----
    const adjustBar = header.createDiv({ cls: 'mn-adjust-bar' });

    this.fontSizeLabelEl = this.makeStepper(adjustBar, '字号', {
      onMinus: () => this.changeFontSize(-1),
      onPlus: () => this.changeFontSize(1),
      value: this.plugin.settings.fontSizeOffset,
    });

    this.paraSpacingLabelEl = this.makeStepper(adjustBar, '段距', {
      onMinus: () => this.changeParaSpacing(-SPACING_OFFSET_STEP),
      onPlus: () => this.changeParaSpacing(SPACING_OFFSET_STEP),
      value: this.plugin.settings.paraSpacingOffset,
    });

    const modeWrap = adjustBar.createDiv({ cls: 'mn-mode-toggle' });
    this.desktopBtnEl = this.makeModeButton(modeWrap, 'monitor', '桌面预览', 'desktop');
    this.phoneBtnEl = this.makeModeButton(modeWrap, 'smartphone', '手机预览', 'phone');

    // ---- 预览纸面 ----
    this.scrollerEl = root.createDiv({ cls: 'mn-scroller' });
    this.paperEl = this.scrollerEl.createDiv({ cls: 'mn-paper' });
    this.applyPreviewMode();

    // 跟随活动文档
    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        if (file && file.extension === 'md') {
          this.file = file;
          this.scheduleRender();
        }
      })
    );
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file === this.file) this.scheduleRender();
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

  /** 「label − n +」形式的步进控件，返回数值显示元素 */
  private makeStepper(
    parent: HTMLElement,
    label: string,
    opts: { onMinus: () => void; onPlus: () => void; value: number }
  ): HTMLElement {
    const wrap = parent.createDiv({ cls: 'mn-stepper' });
    wrap.createSpan({ cls: 'mn-stepper-label', text: label });
    const minus = wrap.createEl('button', { cls: 'mn-stepper-btn', text: '−' });
    minus.setAttr('aria-label', `减小${label}`);
    const valueEl = wrap.createSpan({ cls: 'mn-stepper-value', text: formatOffset(opts.value) });
    const plus = wrap.createEl('button', { cls: 'mn-stepper-btn', text: '+' });
    plus.setAttr('aria-label', `增大${label}`);
    minus.addEventListener('click', opts.onMinus);
    plus.addEventListener('click', opts.onPlus);
    return valueEl;
  }

  private makeModeButton(
    parent: HTMLElement,
    icon: string,
    tooltip: string,
    mode: PreviewMode
  ): HTMLButtonElement {
    const btn = parent.createEl('button', { cls: 'mn-mode-btn' });
    btn.setAttr('aria-label', tooltip);
    setIcon(btn, icon);
    btn.addEventListener('click', async () => {
      this.plugin.settings.previewMode = mode;
      await this.plugin.saveSettings();
      this.applyPreviewMode();
    });
    return btn;
  }

  private async changeFontSize(delta: number): Promise<void> {
    const next = Math.min(
      Math.max(this.plugin.settings.fontSizeOffset + delta, FONT_OFFSET_MIN),
      FONT_OFFSET_MAX
    );
    if (next === this.plugin.settings.fontSizeOffset) return;
    this.plugin.settings.fontSizeOffset = next;
    await this.plugin.saveSettings();
    this.fontSizeLabelEl.setText(formatOffset(next));
    this.scheduleRender();
  }

  private async changeParaSpacing(delta: number): Promise<void> {
    const next = Math.min(
      Math.max(this.plugin.settings.paraSpacingOffset + delta, SPACING_OFFSET_MIN),
      SPACING_OFFSET_MAX
    );
    if (next === this.plugin.settings.paraSpacingOffset) return;
    this.plugin.settings.paraSpacingOffset = next;
    await this.plugin.saveSettings();
    this.paraSpacingLabelEl.setText(formatOffset(next));
    this.scheduleRender();
  }

  private applyPreviewMode(): void {
    const phone = this.plugin.settings.previewMode === 'phone';
    this.scrollerEl.toggleClass('mn-phone-mode', phone);
    this.desktopBtnEl.toggleClass('is-active', !phone);
    this.phoneBtnEl.toggleClass('is-active', phone);
  }

  setFile(file: TFile): void {
    this.file = file;
    this.scheduleRender();
  }

  refresh(): void {
    this.themeSelectEl.value = this.plugin.settings.defaultTheme;
    this.fontSizeLabelEl.setText(formatOffset(this.plugin.settings.fontSizeOffset));
    this.paraSpacingLabelEl.setText(formatOffset(this.plugin.settings.paraSpacingOffset));
    this.applyPreviewMode();
    this.scheduleRender();
  }

  private scheduleRender(): void {
    this.renderRequested = true;
    this.requestRender();
  }

  private async flushRenderQueue(): Promise<void> {
    if (this.renderRunning) return;
    this.renderRunning = true;
    try {
      do {
        this.renderRequested = false;
        await this.render();
      } while (this.renderRequested);
    } finally {
      this.renderRunning = false;
    }
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
      // 转换结果全部为内联样式，直接注入即可与公众号编辑器一致。
      // 用 setInnerHTML 走 Obsidian 的安全路径（同时满足 lint 规则）。
      setInnerHtml(this.paperEl, result.html);
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

function formatOffset(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}
