import { SiteContent } from '../types';

export async function fetchRemoteContent(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function publishRemoteContent(url: string, content: SiteContent, passcode: string): Promise<void> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'x-admin-passcode': passcode,
    },
    body: JSON.stringify(content),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
}

export async function rotateRemotePasscode(url: string, currentPasscode: string, newPasscode: string): Promise<void> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'x-admin-passcode': currentPasscode,
    },
    body: JSON.stringify({ newPasscode }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
}

