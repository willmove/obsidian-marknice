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
