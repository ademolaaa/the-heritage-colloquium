import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_SITE_CONTENT } from '../data/defaultContent';
import { SiteContent } from '../types';
import { clearSiteContent, loadSiteContent, mergeWithDefaults, saveSiteContent } from '../lib/siteContentStore';
import { fetchRemoteContent } from '../lib/remoteContent';

type SiteContentContextValue = {
  content: SiteContent;
  setContent: React.Dispatch<React.SetStateAction<SiteContent>>;
  resetToDefaults: () => void;
  exportJson: () => string;
  importJson: (raw: string) => { ok: true } | { ok: false; error: string };
};

const SiteContentContext = createContext<SiteContentContextValue | null>(null);

export const SiteContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [content, setContent] = useState<SiteContent>(() => loadSiteContent(DEFAULT_SITE_CONTENT));

  useEffect(() => {
    const isDev = Boolean((import.meta as any).env?.DEV);
    const url =
      ((import.meta as any).env?.VITE_CONTENT_READ_URL as string | undefined) || (isDev ? undefined : '/api/content.php');
    if (!url) return;

    let cancelled = false;
    fetchRemoteContent(url)
      .then((payload) => {
        if (cancelled) return;
        const remote = extractContentPayload(payload);
        if (remote) setContent(mergeWithDefaults(DEFAULT_SITE_CONTENT, remote));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    saveSiteContent(content);
  }, [content]);

  const value = useMemo<SiteContentContextValue>(() => {
    return {
      content,
      setContent,
      resetToDefaults: () => {
        clearSiteContent();
        setContent(DEFAULT_SITE_CONTENT);
      },
      exportJson: () => JSON.stringify(content, null, 2),
      importJson: (raw) => {
        try {
          const parsed = JSON.parse(raw) as SiteContent;
          setContent(mergeWithDefaults(DEFAULT_SITE_CONTENT, parsed));
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSON' };
        }
      },
    };
  }, [content]);

  return <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>;
};

function extractContentPayload(payload: unknown): SiteContent | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  if ('content' in record) {
    const inner = record.content;
    if (inner && typeof inner === 'object') return inner as SiteContent;
    return null;
  }
  return payload as SiteContent;
}

export function useSiteContent(): SiteContentContextValue {
  const ctx = useContext(SiteContentContext);
  if (!ctx) {
    throw new Error('useSiteContent must be used within SiteContentProvider');
  }
  return ctx;
}

