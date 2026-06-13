import { App, FuzzySuggestModal, Modal, Notice, Setting, TFile, requestUrl } from 'obsidian';
import type MarkNicePlugin from './main';
import { ConvertResult, IMAGE_EXTENSIONS, mimeFromExtension } from './converter';
import { WechatClient, describeWechatError } from './wechat-api';

class CoverSuggestModal extends FuzzySuggestModal<TFile> {
  constructor(app: App, private onPick: (file: TFile) => void) {
    super(app);
    this.setPlaceholder('搜索库中的图片作为封面…');
  }

  getItems(): TFile[] {
    return this.app.vault
      .getFiles()
      .filter((f) => IMAGE_EXTENSIONS.includes(f.extension.toLowerCase()) && f.extension.toLowerCase() !== 'svg');
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile): void {
    this.onPick(file);
  }
}

export class PublishModal extends Modal {
  private title: string;
  private author: string;
  private digest: string;
  private cover = '';
  private coverPreviewEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private publishBtn!: HTMLButtonElement;
  private publishing = false;

  constructor(app: App, private plugin: MarkNicePlugin, private file: TFile, private result: ConvertResult) {
    super(app);
    this.title = result.title;
    this.author = result.meta.author ?? plugin.settings.defaultAuthor;
    this.digest = result.meta.digest ?? result.plainText.slice(0, 100);
    this.cover = result.meta.cover ?? result.firstImage?.vaultPath ?? result.firstImage?.url ?? '';
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.modalEl.addClass('mn-modal');

    contentEl.createDiv({ cls: 'mn-modal-title', text: '发送到公众号草稿箱' });
    contentEl.createDiv({
      cls: 'mn-modal-sub',
      text: `《${this.file.basename}》 · 主题：${this.plugin.getCurrentTheme().label}`,
    });

    new Setting(contentEl)
      .setName('标题')
      .setDesc('最多 64 个字符')
      .addText((text) => {
        text.setValue(this.title).onChange((v) => (this.title = v.trim()));
        text.inputEl.addClass('mn-wide-input');
      });

    new Setting(contentEl)
      .setName('作者')
      .setDesc('最多 8 个汉字，可留空')
      .addText((text) => text.setValue(this.author).onChange((v) => (this.author = v.trim())));

    new Setting(contentEl)
      .setName('摘要')
      .setDesc('显示在分享卡片上，最多 120 字，留空则微信自动截取')
      .addTextArea((ta) => {
        ta.setValue(this.digest).onChange((v) => (this.digest = v.trim()));
        ta.inputEl.rows = 3;
        ta.inputEl.addClass('mn-wide-input');
      });

    new Setting(contentEl)
      .setName('封面图')
      .setDesc('库内图片路径或 https 图片链接（必填，微信草稿要求封面）')
      .addText((text) => {
        text.setValue(this.cover).onChange((v) => {
          this.cover = v.trim();
          this.updateCoverPreview();
        });
        text.inputEl.addClasses(['mn-wide-input', 'mn-cover-input']);
      })
      .addButton((btn) =>
        btn.setButtonText('选择图片').onClick(() => {
          new CoverSuggestModal(this.app, (file) => {
            this.cover = file.path;
            const input = this.contentEl.querySelector<HTMLInputElement>('.mn-cover-input');
            if (input) input.value = file.path;
            this.updateCoverPreview();
          }).open();
        })
      );

    this.coverPreviewEl = contentEl.createDiv({ cls: 'mn-cover-preview' });
    this.updateCoverPreview();

    this.statusEl = contentEl.createDiv({ cls: 'mn-publish-status' });

    const footer = contentEl.createDiv({ cls: 'mn-modal-footer' });
    const cancel = footer.createEl('button', { cls: 'mn-btn', text: '取消' });
    cancel.addEventListener('click', () => this.close());
    this.publishBtn = footer.createEl('button', { cls: 'mn-btn mn-btn-primary', text: '发送草稿' });
    this.publishBtn.addEventListener('click', () => void this.publish());
  }

  private updateCoverPreview(): void {
    this.coverPreviewEl.empty();
    if (!this.cover) return;
    let src = '';
    if (this.cover.startsWith('http://') || this.cover.startsWith('https://')) {
      src = this.cover;
    } else {
      const af = this.app.vault.getAbstractFileByPath(this.cover);
      if (af instanceof TFile) src = this.app.vault.getResourcePath(af);
    }
    if (src) {
      this.coverPreviewEl.createEl('img', { attr: { src } });
    } else {
      this.coverPreviewEl.createDiv({ cls: 'mn-cover-missing', text: '⚠ 找不到该图片' });
    }
  }

  private setStatus(text: string): void {
    this.statusEl.setText(text);
  }

  private async resolveCoverData(): Promise<{ data: ArrayBuffer; filename: string; mime: string }> {
    if (this.cover.startsWith('http://') || this.cover.startsWith('https://')) {
      const res = await requestUrl({ url: this.cover, throw: false });
      if (res.status < 200 || res.status >= 300) throw new Error(`封面下载失败：HTTP ${res.status}`);
      const mime = res.headers['content-type']?.split(';')[0] ?? 'image/jpeg';
      return { data: res.arrayBuffer, filename: 'cover.jpg', mime };
    }
    const af = this.app.vault.getAbstractFileByPath(this.cover);
    if (!(af instanceof TFile)) throw new Error(`封面图片不存在：${this.cover}`);
    return {
      data: await this.app.vault.readBinary(af),
      filename: af.name,
      mime: mimeFromExtension(af.extension),
    };
  }

  private async publish(): Promise<void> {
    if (this.publishing) return;
    const { appId, appSecret } = this.plugin.settings;
    if (!appId || !appSecret) {
      new Notice('请先在插件设置中填写 WeChat App ID 与 App Secret');
      return;
    }
    if (!this.title) {
      new Notice('标题不能为空');
      return;
    }
    if (!this.cover) {
      new Notice('微信草稿要求封面图，请选择一张图片');
      return;
    }

    this.publishing = true;
    this.publishBtn.disabled = true;
    this.publishBtn.setText('发送中…');

    try {
      const client = new WechatClient(appId, appSecret);

      this.setStatus('① 获取接口凭证…');
      await client.getAccessToken();

      this.setStatus('② 上传封面图…');
      const cover = await this.resolveCoverData();
      const thumbMediaId = await client.uploadThumb(cover.data, cover.filename, cover.mime);

      this.setStatus('③ 上传正文图片…');
      const content = await client.rewriteContentImages(this.result.html, (done, total) =>
        this.setStatus(`③ 上传正文图片… ${done}/${total}`)
      );

      this.setStatus('④ 创建草稿…');
      const mediaId = await client.addDraft({
        title: this.title.slice(0, 64),
        author: this.author.slice(0, 16),
        digest: this.digest.slice(0, 120),
        content,
        thumb_media_id: thumbMediaId,
        need_open_comment: 0,
        only_fans_can_comment: 0,
      });

      this.setStatus('');
      new Notice(`✅ 草稿创建成功！\n请到公众号后台「草稿箱」查看。\nmedia_id: ${mediaId}`, 8000);
      this.close();
    } catch (err) {
      console.error('[MarkNice WeChat] publish failed', err);
      const msg = describeWechatError(err);
      this.setStatus(`❌ ${msg}`);
      new Notice(`发送失败：${msg}`, 8000);
    } finally {
      this.publishing = false;
      this.publishBtn.disabled = false;
      this.publishBtn.setText('发送草稿');
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
