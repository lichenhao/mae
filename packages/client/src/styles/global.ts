/**
 * Global Styles - 全局样式
 */

import { colors, spacing, fontSize, borderRadius, shadows, transitions, layout } from './tokens'

export const globalStyles = `
:root {
  /* 颜色 */
  --color-primary-50: ${colors.primary[50]};
  --color-primary-100: ${colors.primary[100]};
  --color-primary-200: ${colors.primary[200]};
  --color-primary-300: ${colors.primary[300]};
  --color-primary-400: ${colors.primary[400]};
  --color-primary-500: ${colors.primary[500]};
  --color-primary-600: ${colors.primary[600]};
  --color-primary-700: ${colors.primary[700]};
  --color-primary-800: ${colors.primary[800]};
  --color-primary-900: ${colors.primary[900]};

  --color-gray-50: ${colors.gray[50]};
  --color-gray-100: ${colors.gray[100]};
  --color-gray-200: ${colors.gray[200]};
  --color-gray-300: ${colors.gray[300]};
  --color-gray-400: ${colors.gray[400]};
  --color-gray-500: ${colors.gray[500]};
  --color-gray-600: ${colors.gray[600]};
  --color-gray-700: ${colors.gray[700]};
  --color-gray-800: ${colors.gray[800]};
  --color-gray-900: ${colors.gray[900]};

  --color-success: ${colors.semantic.success};
  --color-warning: ${colors.semantic.warning};
  --color-error: ${colors.semantic.error};
  --color-info: ${colors.semantic.info};

  /* 间距 */
  --spacing-xs: ${spacing.xs};
  --spacing-sm: ${spacing.sm};
  --spacing-md: ${spacing.md};
  --spacing-lg: ${spacing.lg};
  --spacing-xl: ${spacing.xl};

  /* 字体 */
  --font-size-xs: ${fontSize.xs};
  --font-size-sm: ${fontSize.sm};
  --font-size-base: ${fontSize.base};
  --font-size-lg: ${fontSize.lg};
  --font-size-xl: ${fontSize.xl};

  /* 圆角 */
  --radius-sm: ${borderRadius.sm};
  --radius-md: ${borderRadius.md};
  --radius-lg: ${borderRadius.lg};
  --radius-xl: ${borderRadius.xl};
  --radius-full: ${borderRadius.full};

  /* 阴影 */
  --shadow-sm: ${shadows.sm};
  --shadow-md: ${shadows.md};
  --shadow-lg: ${shadows.lg};

  /* 过渡 */
  --transition-fast: ${transitions.fast};
  --transition-normal: ${transitions.normal};

  /* 布局 */
  --sidebar-width: ${layout.sidebarWidth};
}

/* 深色主题 */
[data-theme="dark"] {
  --color-bg: ${colors.background.dark};
  --color-bg-card: ${colors.gray[800]};
  --color-bg-sidebar: ${colors.gray[900]};
  --color-text: ${colors.text.inverse};
  --color-text-secondary: ${colors.gray[400]};
  --color-text-muted: ${colors.gray[500]};
  --color-border: ${colors.gray[700]};
}

/* 浅色主题 */
[data-theme="light"] {
  --color-bg: ${colors.background.light};
  --color-bg-card: ${colors.background.card};
  --color-bg-sidebar: ${colors.background.sidebar};
  --color-text: ${colors.text.primary};
  --color-text-secondary: ${colors.text.secondary};
  --color-text-muted: ${colors.text.muted};
  --color-border: ${colors.border.light};
}

/* 全局重置 */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.5;
  background-color: var(--color-bg);
  color: var(--color-text);
}

/* 链接 */
a {
  color: var(--color-primary-600);
  text-decoration: none;
  transition: color var(--transition-fast);
}

a:hover {
  color: var(--color-primary-700);
}

/* 按钮 */
button {
  font-family: inherit;
  cursor: pointer;
  border: none;
  background: none;
}

/* 输入框 */
input,
textarea {
  font-family: inherit;
  font-size: var(--font-size-base);
}

/* 滚动条 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--color-gray-300);
  border-radius: var(--radius-full);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-gray-400);
}

/* 选中文本 */
::selection {
  background: var(--color-primary-200);
  color: var(--color-primary-900);
}
`

export const componentStyles = {
  // 按钮
  button: {
    primary: `
      background: var(--color-primary-600);
      color: white;
      padding: var(--spacing-sm) var(--spacing-md);
      border-radius: var(--radius-md);
      font-weight: 500;
      transition: all var(--transition-fast);
    `,
    secondary: `
      background: var(--color-gray-100);
      color: var(--color-gray-700);
      padding: var(--spacing-sm) var(--spacing-md);
      border-radius: var(--radius-md);
      font-weight: 500;
      transition: all var(--transition-fast);
    `,
    ghost: `
      background: transparent;
      color: var(--color-gray-600);
      padding: var(--spacing-sm) var(--spacing-md);
      border-radius: var(--radius-md);
      transition: all var(--transition-fast);
    `,
  },

  // 卡片
  card: `
    background: var(--color-bg-card);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--color-border);
  `,

  // 输入框
  input: `
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    color: var(--color-text);
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  `,

  // 消息气泡
  messageBubble: (role: string) => {
    const roleColors: Record<string, string> = {
      USER: colors.message.user,
      ASSISTANT: colors.message.assistant,
      SYSTEM: colors.message.system,
      WORKER: colors.message.worker,
    }
    return `
      padding: var(--spacing-md);
      border-radius: var(--radius-lg);
      background: ${roleColors[role] || colors.message.assistant};
      max-width: 80%;
    `
  },

  // 侧边栏
  sidebar: `
    width: var(--sidebar-width);
    background: var(--color-bg-sidebar);
    border-right: 1px solid var(--color-border);
    height: 100vh;
    overflow-y: auto;
  `,
}