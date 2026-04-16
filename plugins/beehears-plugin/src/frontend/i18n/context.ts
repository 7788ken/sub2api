import { createContext, useContext } from 'react';
import type { Locale, Messages } from './locales';
import { messages } from './locales';

export type ThemeMode = 'light' | 'dark';

export type PluginContext = {
  locale: Locale;
  theme: ThemeMode;
  t: Messages;
};

const defaultCtx: PluginContext = {
  locale: 'zh',
  theme: 'dark',
  t: messages.zh,
};

const Ctx = createContext<PluginContext>(defaultCtx);

export const PluginProvider = Ctx.Provider;

export function usePlugin(): PluginContext {
  return useContext(Ctx);
}

/** Parse iframe URL params into locale + theme */
export function parseEmbedParams(): { locale: Locale; theme: ThemeMode } {
  const params = new URLSearchParams(window.location.search);

  const rawLang = (params.get('lang') || '').toLowerCase();
  const locale: Locale = rawLang.startsWith('en') ? 'en' : 'zh';

  const rawTheme = (params.get('theme') || '').toLowerCase();
  const theme: ThemeMode = rawTheme === 'light' ? 'light' : 'dark';

  return { locale, theme };
}
