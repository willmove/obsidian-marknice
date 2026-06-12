export interface WechatTheme {
  id: string;
  /** 在 UI 中显示的名称 */
  label: string;
  bodyFont: string;
  text: string;
  heading: string;
  accent: string;
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
}

export const THEMES: Record<string, WechatTheme> = {
  claude: {
    id: 'claude',
    label: 'Claude 暖陶',
    bodyFont:
      "-apple-system,BlinkMacSystemFont,'Helvetica Neue','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif",
    text: '#3d3929',
    heading: '#181815',
    accent: '#d97757',
    strong: '#c2613f',
    quoteBg: '#faf9f5',
    quoteBorder: '#d97757',
    codeBg: '#f5f4ef',
    hr: '#e8e6dc',
    markBg: '#f9e8e0',
  },
  default: {
    id: 'default',
    label: '经典蓝',
    bodyFont:
      "-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',Arial,sans-serif",
    text: '#2c3e50',
    heading: '#1f2d3d',
    accent: '#2d8cf0',
    quoteBg: '#f7f7f7',
    quoteBorder: '#2d8cf0',
    codeBg: '#f6f8fa',
    hr: '#eaecef',
    markBg: '#dcedff',
  },
  simple: {
    id: 'simple',
    label: '杂志衬线',
    bodyFont: "Georgia,'PingFang SC','Microsoft YaHei',serif",
    text: '#333333',
    heading: '#111111',
    accent: '#3f51b5',
    quoteBg: '#fafafa',
    quoteBorder: '#3f51b5',
    codeBg: '#f5f5f5',
    hr: '#dddddd',
    markBg: '#e3e6f7',
  },
  tech: {
    id: 'tech',
    label: '极客深色',
    bodyFont: "Inter,'PingFang SC','Microsoft YaHei',sans-serif",
    text: '#dbe7ff',
    heading: '#ffffff',
    accent: '#56b6ff',
    quoteBg: '#111827',
    quoteBorder: '#56b6ff',
    codeBg: '#0f172a',
    codeText: '#dbe7ff',
    hr: '#334155',
    markBg: '#1d3a5f',
    pageBg: '#020617',
  },
  elegant: {
    id: 'elegant',
    label: '优雅棕',
    bodyFont: "'Times New Roman','PingFang SC','Microsoft YaHei',serif",
    text: '#4a403a',
    heading: '#2d241f',
    accent: '#9c6b4f',
    quoteBg: '#fbf7f3',
    quoteBorder: '#9c6b4f',
    codeBg: '#f8f3ee',
    hr: '#d9c6b8',
    markBg: '#f3e4d6',
  },
  vivid: {
    id: 'vivid',
    label: '活力红',
    bodyFont: "'PingFang SC','Microsoft YaHei',sans-serif",
    text: '#233044',
    heading: '#0f172a',
    accent: '#ff6b6b',
    strong: '#e05252',
    quoteBg: '#fff4f4',
    quoteBorder: '#ff6b6b',
    codeBg: '#fff8f1',
    hr: '#ffd6d6',
    markBg: '#ffe3e3',
  },
  minimal: {
    id: 'minimal',
    label: '极简黑白',
    bodyFont: "'PingFang SC','Microsoft YaHei',sans-serif",
    text: '#222222',
    heading: '#111111',
    accent: '#111111',
    quoteBg: '#fafafa',
    quoteBorder: '#111111',
    codeBg: '#f4f4f4',
    hr: '#e5e5e5',
    markBg: '#eeeeee',
  },
  amber: {
    id: 'amber',
    label: '琥珀橙',
    bodyFont: "'PingFang SC','Microsoft YaHei',sans-serif",
    text: '#4b3621',
    heading: '#2f1b05',
    accent: '#d97706',
    strong: '#b45309',
    quoteBg: '#fff7ed',
    quoteBorder: '#d97706',
    codeBg: '#fffbeb',
    hr: '#fcd34d',
    markBg: '#fef3c7',
  },
};

export const DEFAULT_THEME_ID = 'claude';

export function getTheme(id: string): WechatTheme {
  return THEMES[id] ?? THEMES[DEFAULT_THEME_ID];
}
