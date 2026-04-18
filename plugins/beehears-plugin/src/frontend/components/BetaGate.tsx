import { useState, useCallback } from 'react';
import { Input, Button, App } from 'antd';
import { usePlugin } from '../i18n/context';

const STORAGE_KEY = 'beehears_beta_unlocked';

function isUnlocked(): boolean {
  return sessionStorage.getItem(STORAGE_KEY) === '1';
}

async function verifyPassword(password: string): Promise<boolean> {
  try {
    const res = await fetch('/api/beta/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

export function BetaGate({ children }: { children: React.ReactNode }) {
  const { t } = usePlugin();
  const { message } = App.useApp();
  const [unlocked, setUnlocked] = useState(isUnlocked);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!password.trim()) return;
    setLoading(true);
    const ok = await verifyPassword(password.trim());
    setLoading(false);
    if (ok) {
      sessionStorage.setItem(STORAGE_KEY, '1');
      setUnlocked(true);
    } else {
      message.error(t.beta_wrong_password);
    }
  }, [password, message, t]);

  if (unlocked) return <>{children}</>;

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
