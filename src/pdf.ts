function escapeHtml(str = ''): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 把转换后的内联样式 HTML 包成一个适合打印的完整文档。
 *
 * 转换结果（result.html）本身已是自包含的内联样式 HTML：图片为 data URL，
 * 公式已渲染为 MathML（Chromium/Electron 原生支持），无需再加载外部资源。
 * 这里只补充打印友好的页面级样式：去除浏览器默认页眉页脚边距、设置 @page 页边距、
 * 让长代码块/表格在分页时尽量不被割裂。
 */
export function buildPrintableHtml(bodyHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title || 'Export')}</title>
<style>
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    color: #333;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .mn-pdf-page {
    box-sizing: border-box;
    max-width: 800px;
    margin: 0 auto;
    padding: 24px 28px;
  }
  .mn-pdf-page img { max-width: 100%; height: auto; }
  .mn-pdf-page pre,
  .mn-pdf-page blockquote,
  .mn-pdf-page table,
  .mn-pdf-page figure { page-break-inside: avoid; }
  .mn-pdf-page h1,
  .mn-pdf-page h2,
  .mn-pdf-page h3,
  .mn-pdf-page h4 { page-break-after: avoid; }
  @media print {
    .mn-pdf-page { max-width: none; margin: 0; padding: 0; }
    @page { margin: 16mm 12mm; }
  }
</style>
</head>
<body>
<div class="mn-pdf-page">${bodyHtml}</div>
</body>
</html>`;
}

interface DesktopRequireWindow extends Window {
  require?: (moduleName: string) => unknown;
}

interface ElectronRemoteLike {
  BrowserWindow: new (options: BrowserWindowOptionsLike) => BrowserWindowLike;
}

interface ElectronModuleLike {
  remote?: ElectronRemoteLike;
}

interface BrowserWindowOptionsLike {
  show: boolean;
  width: number;
  height: number;
  webPreferences: {
    contextIsolation: boolean;
    nodeIntegration: boolean;
    sandbox: boolean;
  };
}

interface BrowserWindowLike {
  loadFile(filePath: string): Promise<void>;
  isDestroyed(): boolean;
  destroy(): void;
  webContents: {
    executeJavaScript<T>(code: string): Promise<T>;
    printToPDF(options: PdfPrintOptionsLike): Promise<Uint8Array>;
  };
}

interface PdfPrintOptionsLike {
  landscape: boolean;
  pageSize: string;
  preferCSSPageSize: boolean;
  printBackground: boolean;
}

interface FsPromisesLike {
  writeFile(path: string, data: string, encoding: BufferEncoding): Promise<void>;
  rm(path: string, options: { force: boolean }): Promise<void>;
}

interface PathLike {
  join(...paths: string[]): string;
}

interface OsLike {
  tmpdir(): string;
}

function getDesktopRequire(): (moduleName: string) => unknown {
  const requireFn = (window as DesktopRequireWindow).require ?? (typeof require === 'function' ? require : undefined);
  if (!requireFn) throw new Error('当前环境无法访问桌面端运行时');
  return requireFn;
}

function getElectronRemote(requireFn: (moduleName: string) => unknown): ElectronRemoteLike {
  const electron = requireFn('electron') as ElectronModuleLike;
  if (electron.remote?.BrowserWindow) return electron.remote;

  try {
    const remote = requireFn('@electron/remote') as ElectronRemoteLike;
    if (remote?.BrowserWindow) return remote;
  } catch {
    // Obsidian 常见版本通过 electron.remote 暴露远程 BrowserWindow；这里仅兼容 @electron/remote。
  }

  throw new Error('当前 Obsidian 桌面端未暴露 PDF 渲染所需的 Electron BrowserWindow');
}

function getNodeHelpers(requireFn: (moduleName: string) => unknown): { fs: FsPromisesLike; os: OsLike; path: PathLike } {
  return {
    fs: requireFn('fs/promises') as FsPromisesLike,
    os: requireFn('os') as OsLike,
    path: requireFn('path') as PathLike,
  };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function createTempHtmlPath(path: PathLike, os: OsLike): string {
  const random = Math.random().toString(36).slice(2);
  return path.join(os.tmpdir(), `marknice-pdf-${Date.now()}-${random}.html`);
}

async function waitForPdfLayout(win: BrowserWindowLike): Promise<void> {
  await win.webContents.executeJavaScript<boolean>(`
    (async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const imagePromises = Array.from(document.images)
        .filter((img) => !img.complete)
        .map((img) => new Promise((resolve) => {
          const done = () => resolve(true);
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        }));

      await Promise.race([Promise.all(imagePromises), wait(8000)]);
      if (document.fonts && document.fonts.ready) {
        await Promise.race([document.fonts.ready.catch(() => undefined), wait(3000)]);
      }
      await wait(200);
      return true;
    })();
  `);
}

/**
 * 在隐藏 Electron 窗口中渲染 HTML，并直接用 printToPDF 生成 PDF 数据。
 * 这样不会触发系统打印对话框，调用方可以像 Word 导出一样把二进制写入仓库。
 */
export async function createPdfArrayBuffer(html: string, title: string): Promise<ArrayBuffer> {
  const requireFn = getDesktopRequire();
  const remote = getElectronRemote(requireFn);
  const { fs, os, path } = getNodeHelpers(requireFn);
  const htmlPath = createTempHtmlPath(path, os);
  const win = new remote.BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  try {
    await fs.writeFile(htmlPath, buildPrintableHtml(html, title), 'utf8');
    await win.loadFile(htmlPath);
    await waitForPdfLayout(win);
    const pdfBytes = await win.webContents.printToPDF({
      landscape: false,
      pageSize: 'A4',
      preferCSSPageSize: true,
      printBackground: true,
    });
    return toArrayBuffer(pdfBytes);
  } finally {
    if (!win.isDestroyed()) win.destroy();
    await fs.rm(htmlPath, { force: true });
  }
}
