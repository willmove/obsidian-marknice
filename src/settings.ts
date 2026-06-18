import { App, PluginSettingTab, Setting } from 'obsidian';
import type MarkNicePlugin from './main';
import { THEMES } from './themes';

export type PreviewMode = 'desktop' | 'phone';

export interface MarkNiceSettings {
  appId: string;
  appSecret: string;
  defaultTheme: string;
  defaultAuthor: string;
  includeTitleInBody: boolean;
  /** 字号偏移（px），影响预览、复制到公众号与发公众号草稿 */
  fontSizeOffset: number;
  /** 段距偏移（px） */
  paraSpacingOffset: number;
  /** 预览模式：桌面 / 手机 */
  previewMode: PreviewMode;
}

export const DEFAULT_SETTINGS: MarkNiceSettings = {
  appId: '',
  appSecret: '',
  defaultTheme: 'claude',
  defaultAuthor: '',
  includeTitleInBody: false,
  fontSizeOffset: 0,
  paraSpacingOffset: 0,
  previewMode: 'phone',
};

export const FONT_OFFSET_MIN = -6;
export const FONT_OFFSET_MAX = 6;
export const SPACING_OFFSET_MIN = -16;
export const SPACING_OFFSET_MAX = 24;
export const SPACING_OFFSET_STEP = 2;

export class MarkNiceSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: MarkNicePlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('mn-settings');

    const hero = containerEl.createDiv({ cls: 'mn-settings-hero' });
    hero.createDiv({ cls: 'mn-settings-hero-title', text: 'MarkNice WeChat' });
    hero.createDiv({
      cls: 'mn-settings-hero-sub',
      text: '把笔记变成漂亮的公众号文章 — 排版、复制、发公众号草稿，一气呵成。',
    });

    new Setting(containerEl).setName('排版').setHeading();

    new Setting(containerEl)
      .setName('默认主题')
      .setDesc('转换与预览时默认使用的排版主题，预览面板中可随时切换。')
      .addDropdown((dd) => {
        for (const theme of Object.values(THEMES)) dd.addOption(theme.id, theme.label);
        dd.setValue(this.plugin.settings.defaultTheme).onChange(async (value) => {
          this.plugin.settings.defaultTheme = value;
          await this.plugin.saveSettings();
          this.plugin.refreshPreview();
        });
      });

    new Setting(containerEl)
      .setName('字号调整')
      .setDesc('在主题默认字号基础上整体增减（px），预览面板中也可随时调节。')
      .addSlider((slider) =>
        slider
          .setLimits(FONT_OFFSET_MIN, FONT_OFFSET_MAX, 1)
          .setValue(this.plugin.settings.fontSizeOffset)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.fontSizeOffset = value;
            await this.plugin.saveSettings();
            this.plugin.refreshPreview();
          })
      );

    new Setting(containerEl)
      .setName('段距调整')
      .setDesc('调整段落与标题的上下间距（px），让文章更紧凑或更疏朗。')
      .addSlider((slider) =>
        slider
          .setLimits(SPACING_OFFSET_MIN, SPACING_OFFSET_MAX, SPACING_OFFSET_STEP)
          .setValue(this.plugin.settings.paraSpacingOffset)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.paraSpacingOffset = value;
            await this.plugin.saveSettings();
            this.plugin.refreshPreview();
          })
      );

    new Setting(containerEl)
      .setName('正文中包含标题')
      .setDesc('开启后会把标题作为大标题放进正文开头。公众号的标题是单独字段，通常建议关闭。')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.includeTitleInBody).onChange(async (value) => {
          this.plugin.settings.includeTitleInBody = value;
          await this.plugin.saveSettings();
          this.plugin.refreshPreview();
        })
      );

    new Setting(containerEl)
      .setName('默认作者')
      .setDesc('发公众号草稿时的默认作者名（最多 8 个汉字），笔记 frontmatter 中的 author 字段优先。')
      .addText((text) =>
        text
          .setPlaceholder('例如：南乔')
          .setValue(this.plugin.settings.defaultAuthor)
          .onChange(async (value) => {
            this.plugin.settings.defaultAuthor = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setName('公众号接口').setHeading();

    new Setting(containerEl)
      .setName('WeChat App ID')
      .setDesc('微信公众平台 → 设置与开发 → 基本配置 → 开发者 ID(AppID)。')
      .addText((text) => {
        text
          .setPlaceholder('wx1234567890abcdef')
          .setValue(this.plugin.settings.appId)
          .onChange(async (value) => {
            this.plugin.settings.appId = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.addClass('mn-wide-input');
      });

    new Setting(containerEl)
      .setName('WeChat App Secret')
      .setDesc('开发者密码(AppSecret)。只保存在本地库的插件数据中，请勿截图泄露。')
      .addText((text) => {
        text
          .setPlaceholder('••••••••••••••••')
          .setValue(this.plugin.settings.appSecret)
          .onChange(async (value) => {
            this.plugin.settings.appSecret = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.type = 'password';
        text.inputEl.addClass('mn-wide-input');
      });

    const tip = containerEl.createDiv({ cls: 'mn-settings-tip' });
    tip.createSpan({ text: '提示：调用公众号接口要求把本机出口 IP 加入 ' });
    tip.createEl('strong', { text: 'IP 白名单' });
    tip.createSpan({
      text: '（公众平台 → 设置与开发 → 基本配置）。草稿箱接口需要已认证的公众号。',
    });
  }
}
