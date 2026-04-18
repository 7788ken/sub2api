import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, theme as antTheme } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './styles.css';
import { messages } from './i18n/locales';
import { PluginProvider, parseEmbedParams } from './i18n/context';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const { locale, theme: themeMode } = parseEmbedParams();
const t = messages[locale];

if (themeMode === 'light') {
  document.documentElement.classList.add('light');
}

const pluginCtx = { locale, theme: themeMode, t };

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <PluginProvider value={pluginCtx}>
      <ConfigProvider
        theme={{
          algorithm: themeMode === 'light' ? antTheme.defaultAlgorithm : antTheme.darkAlgorithm,
          token: {
            colorPrimary: '#06b6d4',
            borderRadius: 12,
            colorInfo: '#06b6d4',
            colorBgContainer: themeMode === 'light' ? '#ffffff' : '#18181b',
            colorBgElevated: themeMode === 'light' ? '#f4f4f5' : '#27272a',
          },
        }}
      >
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ConfigProvider>
    </PluginProvider>
  </React.StrictMode>,
);
