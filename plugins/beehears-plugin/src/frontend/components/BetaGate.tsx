import { useEffect, useState } from 'react';
import { Alert, Input, Button, App, Spin } from 'antd';
import { usePlugin } from '../i18n/context';

const IFRAME_TOKEN = new URLSearchParams(window.location.search).get('token') ?? '';

type BetaStatus = {
  required: boolean;
  unlocked: boolean;
};

type VerifyResult = 'ok' | 'wrong' | 'auth' | 'rate_limited';
type StatusResult = BetaStatus | 'auth' | 'error';

function buildAuthHeaders(): Record<string, string> {
  return IFRAME_TOKEN ? { 'x-sub2api-token': IFRAME_TOKEN } : {};
}

async function fetchBetaStatus(): Promise<StatusResult> {
  const res = await fetch('/api/beta/status', {
    method: 'GET',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });

  const data = await res.json();
  if (res.ok && data.success === true) {
    return data.data as BetaStatus;
  }
  if (res.status === 401) {
    return 'auth';
  }
  return 'error';
}

async function verifyPassword(password: string): Promise<VerifyResult> {
  const res = await fetch('/api/beta/verify', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(),
    },
    body: JSON.stringify({ password }),
  });

  const data = await res.json();
  if (res.ok && data.success === true) {
    return 'ok';
  }
  if (res.status === 401) {
    return 'auth';
  }
  if (res.status === 429) {
    return 'rate_limited';
  }
  return 'wrong';
}

export function BetaGate({ children }: { children: React.ReactNode }) {
  const { t } = usePlugin();
  const { message } = App.useApp();
  const [status, setStatus] = useState<BetaStatus | null>(null);
  const [statusState, setStatusState] = useState<'loading' | 'ready' | 'auth' | 'error'>('loading');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      setStatusState('loading');
      try {
        const result = await fetchBetaStatus();
        if (cancelled) {
          return;
        }

        if (result === 'auth') {
          setStatus(null);
          setStatusState('auth');
          return;
        }

        if (result === 'error') {
          setStatus(null);
          setStatusState('error');
          return;
        }

        setStatus(result);
        setStatusState('ready');
      } catch {
        if (cancelled) {
          return;
        }
        setStatus(null);
        setStatusState('error');
      }
    }

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit() {
    if (!password.trim()) return;
    setLoading(true);
    let result: VerifyResult = 'wrong';
    try {
      result = await verifyPassword(password.trim());
    } catch {
      result = 'wrong';
    }
    setLoading(false);
    if (result === 'ok') {
      setStatus({ required: true, unlocked: true });
      setStatusState('ready');
      setPassword('');
      return;
    }
    if (result === 'auth') {
      message.error(t.beta_auth_required);
      setStatusState('auth');
      return;
    }
    if (result === 'rate_limited') {
      message.error(t.beta_rate_limited);
      return;
    }
    message.error(t.beta_wrong_password);
  }

  if (statusState === 'loading') {
    return (
      <div className="ssc-beta-gate">
        <Spin size="large" />
      </div>
    );
  }

  if (statusState === 'auth') {
    return (
      <div className="ssc-beta-gate">
        <Alert
          type="warning"
          showIcon
          message={t.beta_title}
          description={t.beta_auth_required}
        />
      </div>
    );
  }

  if (statusState === 'error') {
    return (
      <div className="ssc-beta-gate">
        <Alert
          type="error"
          showIcon
          message={t.error_title}
          description={t.error_desc}
        />
      </div>
    );
  }

  if (status && (!status.required || status.unlocked)) return <>{children}</>;

  return (
    <div className="ssc-beta-gate">
      <h2>{t.beta_title}</h2>
      <p>{t.beta_desc}</p>
      <div className="ssc-beta-form">
        <Input.Password
          placeholder={t.beta_placeholder}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onPressEnter={handleSubmit}
          style={{ width: 240 }}
        />
        <Button type="primary" loading={loading} onClick={handleSubmit}>
          {t.beta_submit}
        </Button>
      </div>
    </div>
  );
}
