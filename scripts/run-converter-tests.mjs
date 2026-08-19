/** 回归测试入口：把 TS 测试用 esbuild 打包后在 Node 中运行。 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outfile = join(root, 'scripts', '.converter-tests.bundle.cjs');

await build({
  entryPoints: [join(root, 'scripts', 'converter-tests.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile,
  alias: { obsidian: join(root, 'scripts', 'obsidian-stub.mjs') },
  logLevel: 'warning',
});

await import(pathToFileURL(outfile).href);
