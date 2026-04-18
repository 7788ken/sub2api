import { type ComponentType, lazy, Suspense } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IconLoader = () => Promise<any>;

type PlanIconEntry = {
  keywords: string[];
  load: IconLoader;
  color: string;
};

const ICON_REGISTRY: PlanIconEntry[] = [
  { keywords: ['claude', 'anthropic'], load: () => import('@lobehub/icons/es/Claude'), color: '#d97757' },
  { keywords: ['gpt', 'openai', 'chatgpt', 'o1', 'o3', 'o4'], load: () => import('@lobehub/icons/es/OpenAI'), color: '#74aa9c' },
  { keywords: ['gemini', 'google'], load: () => import('@lobehub/icons/es/Gemini'), color: '#4285f4' },
  { keywords: ['deepseek'], load: () => import('@lobehub/icons/es/DeepSeek'), color: '#4d6bfe' },
  { keywords: ['qwen', 'tongyi', '通义'], load: () => import('@lobehub/icons/es/Qwen'), color: '#6366f1' },
  { keywords: ['llama', 'meta'], load: () => import('@lobehub/icons/es/Meta'), color: '#0668e1' },
  { keywords: ['mistral'], load: () => import('@lobehub/icons/es/Mistral'), color: '#f7d046' },
  { keywords: ['grok', 'xai'], load: () => import('@lobehub/icons/es/Grok'), color: '#f5f5f5' },
  { keywords: ['groq'], load: () => import('@lobehub/icons/es/Groq'), color: '#f55036' },
  { keywords: ['minimax'], load: () => import('@lobehub/icons/es/Minimax'), color: '#00d1a7' },
  { keywords: ['zhipu', 'glm', 'chatglm'], load: () => import('@lobehub/icons/es/Zhipu'), color: '#3b6eff' },
  { keywords: ['doubao', '豆包'], load: () => import('@lobehub/icons/es/Doubao'), color: '#3370ff' },
  { keywords: ['yi', '零一'], load: () => import('@lobehub/icons/es/Yi'), color: '#0a0a0a' },
  { keywords: ['spark', '讯飞'], load: () => import('@lobehub/icons/es/Spark'), color: '#0070f0' },
  { keywords: ['perplexity'], load: () => import('@lobehub/icons/es/Perplexity'), color: '#20808d' },
];

const iconCache = new Map<string, ComponentType<{ size?: number }>>();

function matchEntry(planName: string): PlanIconEntry | undefined {
  const lower = planName.toLowerCase();
  return ICON_REGISTRY.find((e) => e.keywords.some((k) => lower.includes(k)));
}

function getLazyIcon(entry: PlanIconEntry): ComponentType<{ size?: number }> {
  const key = entry.keywords[0];
  const cached = iconCache.get(key);
  if (cached) return cached;

  const LazyIcon = lazy(async () => {
    const mod = await entry.load();
    const Icon = mod.default as ComponentType<{ size?: number | string }>;
    return {
      default: ({ size = 20 }: { size?: number }) => <Icon size={size} />,
    };
  });

  const Wrapped = ({ size = 20 }: { size?: number }) => (
    <Suspense fallback={<span style={{ display: 'inline-block', width: size, height: size }} />}>
      <LazyIcon size={size} />
    </Suspense>
  );

  iconCache.set(key, Wrapped);
  return Wrapped;
}

export function getPlanIconColor(planName: string): string {
  return matchEntry(planName)?.color ?? '#8b949e';
}

export function getPlanCategory(planName: string): string | null {
  const lower = planName.toLowerCase();
  if (lower.includes('claude') || lower.includes('anthropic')) return 'Claude';
  if (lower.includes('gpt') || lower.includes('openai') || lower.includes('chatgpt') || lower.includes('o1') || lower.includes('o3') || lower.includes('o4')) return 'OpenAI';
  if (lower.includes('gemini') || lower.includes('google')) return 'Gemini';
  return null;
}

export function PlanIcon({ planName, size = 20 }: { planName: string; size?: number }) {
  const entry = matchEntry(planName);
  if (!entry) {
    return (
      <span
        className="ssc-plan-icon-fallback"
        style={{ width: size, height: size, fontSize: size * 0.6 }}
      >
        AI
      </span>
    );
  }
  const Icon = getLazyIcon(entry);
  return <Icon size={size} />;
}
