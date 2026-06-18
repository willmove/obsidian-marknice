export interface WechatTheme {
  id: string;
  /** 在 UI 中显示的名称 */
  label: string;
  bodyFont: string;
  text: string;
  heading: string;
  accent: string;
  /** 标题块背景，适合需要强视觉识别的主题 */
  headingBg?: string;
  /** 标题块文字颜色，缺省时使用 heading */
  headingText?: string;
  /** 标题视觉结构，缺省为普通左边框标题 */
  headingVariant?: "ribbon";
  /** Ribbon 标题右侧斜切尾巴颜色 */
  headingTailBg?: string;
  /** Ribbon 标题底线颜色，缺省时使用 accent */
  headingLine?: string;
  /** 加粗文字颜色，缺省时用 heading */
  strong?: string;
  quoteBg: string;
  quoteBorder: string;
  codeBg: string;
  /** 代码文字颜色，缺省时用 text */
  codeText?: string;
  hr: string;
  /** ==高亮== 背景色 */
  markBg?: string;
  /** 整页背景（深色主题需要） */
  pageBg?: string;
  /** 多层背景的尺寸，缺省时使用浏览器默认值 */
  pageBgSize?: string;
}

export const THEMES: Record<string, WechatTheme> = {
  claude: {
    id: "claude",
    label: "Claude 暖陶",
    bodyFont:
      "-apple-system,BlinkMacSystemFont,'Helvetica Neue','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif",
    text: "#3d3929",
    heading: "#181815",
    accent: "#d97757",
    strong: "#c2613f",
    quoteBg: "#faf9f5",
    quoteBorder: "#d97757",
    codeBg: "#f5f4ef",
    hr: "#e8e6dc",
    markBg: "#f9e8e0",
  },
  minimal: {
    id: "minimal",
    label: "极简黑白",
    bodyFont: "'PingFang SC','Microsoft YaHei',sans-serif",
    text: "#222222",
    heading: "#111111",
    accent: "#111111",
    quoteBg: "#fafafa",
    quoteBorder: "#111111",
    codeBg: "#f4f4f4",
    hr: "#e5e5e5",
    markBg: "#eeeeee",
  },
  "indigo-pink-tech": {
    id: "indigo-pink-tech",
    label: "靛粉渐变",
    bodyFont: "Inter,'PingFang SC','Microsoft YaHei',sans-serif",
    text: "#334155",
    heading: "#312e81",
    accent: "#6366f1",
    headingBg: "linear-gradient(135deg,#6366f1,#ec4899)",
    headingText: "#ffffff",
    strong: "#ec4899",
    quoteBg: "#f8f7ff",
    quoteBorder: "#ec4899",
    codeBg: "#eef2ff",
    codeText: "#4338ca",
    hr: "#e0e7ff",
    markBg: "#fce7f3",
    pageBg:
      "linear-gradient(rgba(99,102,241,0.045) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.045) 1px,transparent 1px),radial-gradient(circle at 92% 8%,rgba(236,72,153,0.16) 0 120px,transparent 122px),radial-gradient(circle at 6% 88%,rgba(99,102,241,0.16) 0 140px,transparent 142px),#ffffff",
    pageBgSize: "40px 40px,40px 40px,auto,auto,auto",
  },
  night: {
    id: "night",
    label: "暗夜深色",
    bodyFont:
      "-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif",
    text: "#d5dbff",
    heading: "#9ec5ff",
    accent: "#7de3ff",
    strong: "#84f0ff",
    quoteBg: "#171b2f",
    quoteBorder: "#7c8cff",
    codeBg: "#23294a",
    codeText: "#d6e0ff",
    hr: "#2f3763",
    markBg: "#1f2a55",
    pageBg: "#0f1220",
  },
  simple: {
    id: "simple",
    label: "简洁蓝",
    bodyFont:
      "-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',Arial,sans-serif",
    text: "#2c3e50",
    heading: "#1f2d3d",
    accent: "#2d8cf0",
    quoteBg: "#f7f7f7",
    quoteBorder: "#2d8cf0",
    codeBg: "#f6f8fa",
    hr: "#eaecef",
    markBg: "#dcedff",
  },
  elegant: {
    id: "elegant",
    label: "优雅棕",
    bodyFont: "'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif",
    text: "#4a3a30",
    heading: "#5a3826",
    accent: "#b08968",
    strong: "#8a5a36",
    quoteBg: "#fffaf2",
    quoteBorder: "#d8b891",
    codeBg: "#f7efe4",
    codeText: "#6b4a35",
    hr: "#eadcc9",
    markBg: "#f6e6cf",
    pageBg: "#fff8ee",
  },
  vivid: {
    id: "vivid",
    label: "活力红",
    bodyFont: "'PingFang SC','Microsoft YaHei',sans-serif",
    text: "#233044",
    heading: "#d94841",
    accent: "#ff6b6b",
    headingBg: "#f1665d",
    headingText: "#ffffff",
    headingVariant: "ribbon",
    headingTailBg: "#e5e7eb",
    headingLine: "#ff6b6b",
    strong: "#e05252",
    quoteBg: "#fff4f4",
    quoteBorder: "#ff6b6b",
    codeBg: "#fff8f1",
    hr: "#ffd6d6",
    markBg: "#ffe3e3",
  },
  amber: {
    id: "amber",
    label: "琥珀橙",
    bodyFont: "'PingFang SC','Microsoft YaHei',sans-serif",
    text: "#4b3621",
    heading: "#2f1b05",
    accent: "#d97706",
    strong: "#b45309",
    quoteBg: "#fff7ed",
    quoteBorder: "#d97706",
    codeBg: "#fffbeb",
    hr: "#fcd34d",
    markBg: "#fef3c7",
  },
  green: {
    id: "green",
    label: "清新绿",
    bodyFont:
      "-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif",
    text: "#2f2f2f",
    heading: "#2e5b1f",
    accent: "#3f7f2f",
    strong: "#3f7f2f",
    quoteBg: "#f6fbef",
    quoteBorder: "#7abf45",
    codeBg: "#eef5e7",
    codeText: "#496e2d",
    hr: "#dbe8cf",
    markBg: "#e4f2d3",
  },
  health: {
    id: "health",
    label: "健康绿",
    bodyFont:
      "-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif",
    text: "#183d34",
    heading: "#123f34",
    accent: "#0f8f67",
    strong: "#087857",
    quoteBg: "#f7fcf9",
    quoteBorder: "#5a8f75",
    codeBg: "#edf7f2",
    codeText: "#0f3129",
    hr: "#dcebe3",
    markBg: "#e5f5ee",
    pageBg:
      "linear-gradient(rgba(18,63,52,0.045) 1px,transparent 1px),linear-gradient(90deg,rgba(18,63,52,0.045) 1px,transparent 1px),#f4faf7",
    pageBgSize: "48px 48px,48px 48px,auto",
  },
  magazine: {
    id: "magazine",
    label: "杂志红",
    bodyFont: "'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif",
    text: "#2f2f33",
    heading: "#7a1f1f",
    accent: "#c23a3a",
    strong: "#992d2d",
    quoteBg: "#fff3f2",
    quoteBorder: "#c23a3a",
    codeBg: "#ffeef0",
    codeText: "#9c2f3a",
    hr: "#e8c2c2",
    markBg: "#ffe0de",
  },
  retro: {
    id: "retro",
    label: "复古纸",
    bodyFont: "Georgia,'Times New Roman','PingFang SC',serif",
    text: "#2f261b",
    heading: "#4a3215",
    accent: "#8b6a35",
    strong: "#7a4e14",
    quoteBg: "#f8f2e8",
    quoteBorder: "#8b6a35",
    codeBg: "#f2e7d4",
    codeText: "#704a1a",
    hr: "#d7c19a",
    markBg: "#f0e3cc",
  },
  purple: {
    id: "purple",
    label: "梦幻紫",
    bodyFont:
      "-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif",
    text: "#333333",
    heading: "#5a3fa0",
    accent: "#7c5cfc",
    strong: "#7c5cfc",
    quoteBg: "#f5f0ff",
    quoteBorder: "#b07cfc",
    codeBg: "#ede8ff",
    codeText: "#7c5cfc",
    hr: "#c4a8ff",
    markBg: "#e9defc",
  },
  ocean: {
    id: "ocean",
    label: "海盐青",
    bodyFont:
      "-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif",
    text: "#1f3a3d",
    heading: "#0b4f55",
    accent: "#0e9594",
    strong: "#0a7e7d",
    quoteBg: "#effbfa",
    quoteBorder: "#0e9594",
    codeBg: "#e8f6f5",
    codeText: "#0b6b6a",
    hr: "#cdeae8",
    markBg: "#d6f3f1",
  },
};

export const DEFAULT_THEME_ID = "claude";

export function getTheme(id: string): WechatTheme {
  return (
    THEMES[id] ??
    Object.values(THEMES).find((theme) => theme.id === id) ??
    THEMES[DEFAULT_THEME_ID]
  );
}
