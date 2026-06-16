declare module 'html-docx-js' {
  const htmlDocx: {
    asBlob(html: string, options?: Record<string, unknown>): Blob;
  };
  export default htmlDocx;
}

declare module 'html-docx-js/dist/html-docx' {
  const htmlDocx: {
    asBlob(html: string, options?: Record<string, unknown>): Blob;
  };
  export default htmlDocx;
}

declare module 'katex' {
  type KatexOutput = 'html' | 'mathml' | 'htmlAndMathml';

  type KatexOptions = {
    displayMode?: boolean;
    throwOnError?: boolean;
    strict?: boolean | string;
    output?: KatexOutput;
  };

  const katex: {
    renderToString(tex: string, options?: KatexOptions): string;
  };

  export default katex;
}
