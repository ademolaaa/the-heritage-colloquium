import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Section } from '../components/Section';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';

interface AdminIntegrationsProps {
  embedded?: boolean;
  passcodeProp?: string;
}

export const AdminIntegrations: React.FC<AdminIntegrationsProps> = ({ embedded = false, passcodeProp }) => {
  const navigate = useNavigate();
  const { isAdmin, isLoading } = useAuth();

  // Integrations state
  const [browserlessKey, setBrowserlessKey] = useState('');
  const [whogohostEmail, setWhogohostEmail] = useState('');
  const [whogohostPassword, setWhogohostPassword] = useState('');
  const [driveFolderId, setDriveFolderId] = useState('');
  const [driveApiKey, setDriveApiKey] = useState('');
  const [driveServiceAccountJson, setDriveServiceAccountJson] = useState('');
  
  // Status & action states
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingBrowserless, setIsTestingBrowserless] = useState(false);
  const [isRunningSync, setIsRunningSync] = useState(false);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [browserlessTestResult, setBrowserlessTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  
  // Alternative ingestion states
  const [isSyncingPublicDrive, setIsSyncingPublicDrive] = useState(false);
  const [isUploadingZip, setIsUploadingZip] = useState(false);
  const [isSyncingLinks, setIsSyncingLinks] = useState(false);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [linksText, setLinksText] = useState('');
  const [zipResult, setZipResult] = useState<{ ok: boolean; message: string } | null>(null);
  const logsConsoleRef = useRef<HTMLDivElement>(null);
  
  // Show/Hide password toggle
  const [showPassword, setShowPassword] = useState(false);
  
  // Terminal logs
  const [logs, setLogs] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const [passcode, setPasscode] = useState(() => {
    const rawEnv = (import.meta as any).env?.VITE_ADMIN_PASSCODE || '';
    return typeof rawEnv === 'string' ? rawEnv.trim() : '';
  });

  useEffect(() => {
    if (passcodeProp !== undefined) {
      setPasscode(passcodeProp);
    }
  }, [passcodeProp]);

  const isDev = Boolean((import.meta as any).env?.DEV);
  const v1ApiBaseUrl = (((import.meta as any).env?.VITE_V1_API_BASE_URL as string | undefined) || '').trim();

  const baseApiUrl = useMemo(() => {
    if (!isDev) return '';
    return v1ApiBaseUrl || '';
  }, [isDev, v1ApiBaseUrl]);

  const setToast = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 3000);
  };

  // Fetch current integration credentials
  useEffect(() => {
    if (!isAdmin && !embedded) return;
    
    const fetchCreds = async () => {
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;
      if (!passcode.trim() && !token) {
        setIsPageLoading(false);
        return;
      }
      try {
        const headers: Record<string, string> = {};
        if (passcode) headers['x-admin-passcode'] = passcode;
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${baseApiUrl}/api/v1/integrations`, {
          headers
        });
        const json = await res.json();
        if (json.ok && json.integrations) {
          setBrowserlessKey(json.integrations.browserless_api_key || '');
          setWhogohostEmail(json.integrations.whogohost_email || '');
          setWhogohostPassword(json.integrations.whogohost_password || '');
          setDriveFolderId(json.integrations.google_drive_folder_id || '');
          setDriveApiKey(json.integrations.google_api_key || '');
          setDriveServiceAccountJson(json.integrations.google_service_account_json || '');
        }
      } catch (err) {
        console.error('Failed to fetch integrations credentials:', err);
        setToast('Failed to load credentials');
      } finally {
        setIsPageLoading(false);
      }
    };

    void fetchCreds();
  }, [isAdmin, embedded, baseApiUrl, passcode]);

  // Save integration credentials
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;
    if (!passcode && !token) {
      setToast('Enter passcode or log in');
      return;
    }
    setIsSaving(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (passcode) headers['x-admin-passcode'] = passcode;
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${baseApiUrl}/api/v1/integrations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          browserless_api_key: browserlessKey,
          whogohost_email: whogohostEmail,
          whogohost_password: whogohostPassword,
          google_drive_folder_id: driveFolderId,
          google_api_key: driveApiKey,
          google_service_account_json: driveServiceAccountJson
        })
      });
      const json = await res.json();
      if (json.ok) {
        setToast('Credentials saved successfully');
      } else {
        setToast('Failed to save credentials');
      }
    } catch (err) {
      console.error(err);
      setToast('Save request failed');
    } finally {
      setIsSaving(false);
    }
  };

  // Test connection to Browserless.io
  const handleTestBrowserless = async () => {
    if (!browserlessKey.trim()) {
      setToast('Please input a Browserless API Key first');
      return;
    }
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;
    if (!passcode && !token) {
      setToast('Enter passcode or log in');
      return;
    }
    setIsTestingBrowserless(true);
    setBrowserlessTestResult(null);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (passcode) headers['x-admin-passcode'] = passcode;
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${baseApiUrl}/api/v1/integrations/test-browserless`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ apiKey: browserlessKey })
      });
      const json = await res.json();
      if (json.ok) {
        setBrowserlessTestResult({
          ok: true,
          message: `Connected successfully! Chrome version: ${json.version}`
        });
      } else {
        setBrowserlessTestResult({
          ok: false,
          message: json.error || 'Connection verification failed'
        });
      }
    } catch (err: any) {
      setBrowserlessTestResult({
        ok: false,
        message: err.message || 'API request failed'
      });
    } finally {
      setIsTestingBrowserless(false);
    }
  };

  // Trigger nameservers update automation
  const handleRunSync = async () => {
    if (!confirm('Are you sure you want to run the automated WhoGoHost DNS sync? This will launch a remote browser job.')) {
      return;
    }
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;
    if (!passcode && !token) {
      setToast('Enter passcode or log in');
      return;
    }
    setIsRunningSync(true);
    setLogs(['[SYSTEM] Initializing remote browser worker...', '[SYSTEM] Connecting to Browserless.io Chrome cluster...']);
    try {
      const headers: Record<string, string> = {};
      if (passcode) headers['x-admin-passcode'] = passcode;
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${baseApiUrl}/api/v1/integrations/run-dns-sync`, {
        method: 'POST',
        headers
      });
      const json = await res.json();
      
      const newLogs = [];
      if (json.stdout) {
        newLogs.push(...json.stdout.split('\n'));
      }
      if (json.stderr) {
        newLogs.push(...json.stderr.split('\n').map((l: string) => `[ERR] ${l}`));
      }
      
      if (json.ok) {
        newLogs.push('[SYSTEM] Automation completed successfully!');
        setToast('WhoGoHost Nameserver configuration sync succeeded!');
      } else {
        newLogs.push(`[SYSTEM] Automation failed with exit code ${json.code}`);
        setToast('WhoGoHost Nameserver configuration sync failed');
      }
      setLogs(newLogs.filter(Boolean));
    } catch (err: any) {
      setLogs(prev => [...prev, `[SYSTEM ERR] Job failed: ${err.message || 'Unknown network error'}`]);
      setToast('Network error triggering worker');
    } finally {
      setIsRunningSync(false);
    }
  };

  const handleRunDriveSync = async () => {
    if (!driveFolderId.trim()) {
      setToast('Please configure a Google Drive Folder ID first');
      return;
    }
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;
    if (!passcode && !token) {
      setToast('Enter passcode or log in');
      return;
    }
    setIsSyncingDrive(true);
    setLogs(['[SYSTEM] Initializing Google Drive synchronization...', '[SYSTEM] Fetching files from Google Drive API...']);
    try {
      const headers: Record<string, string> = {};
      if (passcode) headers['x-admin-passcode'] = passcode;
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${baseApiUrl}/api/v1/integrations/run-drive-sync`, {
        method: 'POST',
        headers
      });
      const json = await res.json();
      
      const newLogs = [];
      if (json.stdout) {
        newLogs.push(...json.stdout.split('\n'));
      }
      if (json.stderr) {
        newLogs.push(...json.stderr.split('\n').map((l: string) => `[ERR] ${l}`));
      }
      
      if (json.ok) {
        newLogs.push('[SYSTEM] Google Drive Sync completed successfully!');
        setToast('Google Drive sync succeeded!');
      } else {
        newLogs.push(`[SYSTEM] Sync failed with exit code ${json.code}`);
        setToast('Google Drive sync failed');
      }
      setLogs(newLogs.filter(Boolean));
    } catch (err: any) {
      setLogs(prev => [...prev, `[SYSTEM ERR] Sync failed: ${err.message || 'Unknown network error'}`]);
      setToast('Network error triggering Drive Sync');
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const handleRunPublicDriveSync = async () => {
    if (!driveFolderId.trim()) {
      setToast('Please configure a Google Drive Folder ID first');
      return;
    }
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;
    if (!passcode && !token) {
      setToast('Enter passcode or log in');
      return;
    }
    setIsSyncingPublicDrive(true);
    setLogs(['[SYSTEM] Initializing public Google Drive crawler...', '[SYSTEM] Scraped pages will process via Browserless...']);
    try {
      const headers: Record<string, string> = {};
      if (passcode) headers['x-admin-passcode'] = passcode;
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${baseApiUrl}/api/v1/integrations/run-public-drive-sync`, {
        method: 'POST',
        headers
      });
      const json = await res.json();
      
      const newLogs = [];
      if (json.stdout) {
        newLogs.push(...json.stdout.split('\n'));
      }
      if (json.stderr) {
        newLogs.push(...json.stderr.split('\n').map((l: string) => `[ERR] ${l}`));
      }
      
      if (json.ok) {
        newLogs.push('[SYSTEM] Public sync completed successfully!');
        setToast('Public Drive sync succeeded!');
      } else {
        newLogs.push(`[SYSTEM] Public sync failed with exit code ${json.code}`);
        setToast('Public Drive sync failed');
      }
      setLogs(newLogs.filter(Boolean));
    } catch (err: any) {
      setLogs(prev => [...prev, `[SYSTEM ERR] Public sync failed: ${err.message || 'Unknown network error'}`]);
      setToast('Network error triggering Public Sync');
    } finally {
      setIsSyncingPublicDrive(false);
    }
  };

  const handleZipUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zipFile) return;

    const token = typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;
    if (!passcode && !token) {
      setToast('Enter passcode or log in');
      return;
    }

    setIsUploadingZip(true);
    setZipResult(null);
    setLogs(['[SYSTEM] Uploading ZIP archive to server...', '[SYSTEM] Direct ZIP parsing initiated...']);

    // Scroll to the terminal console so user sees real-time progress
    setTimeout(() => {
      logsConsoleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
    
    const formData = new FormData();
    formData.append('zipFile', zipFile);

    try {
      const headers: Record<string, string> = {};
      if (passcode) headers['x-admin-passcode'] = passcode;
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let uploadUrl = `${baseApiUrl}/api/v1/integrations/upload-zip`;
      let isLocalRunner = false;

      // Always check if local runner is active on localhost
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5 second timeout
        
        const healthCheck = await fetch('http://127.0.0.1:8787/api/health', { 
          method: 'GET',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (healthCheck.ok) {
          uploadUrl = 'http://127.0.0.1:8787/api/v1/integrations/upload-zip';
          isLocalRunner = true;
          setLogs(prev => [...prev, '⚡ Local runner detected on http://127.0.0.1:8787. Rerouting upload locally to bypass Vercel constraints...']);
        }
      } catch (err) {
        // Local runner is not running, which is fine for small files
      }

      // If local runner is not running and file size exceeds 4.0MB (safe limit for Vercel's 4.5MB request limit with headers), prevent Vercel upload
      if (!isLocalRunner && zipFile.size > 4.0 * 1024 * 1024) {
        throw new Error(`File size (${(zipFile.size / 1024 / 1024).toFixed(2)} MB) exceeds Vercel serverless request limits (4.5 MB with overhead). Please run your local runner using "npm run dev:full" first to process this file, or split it into smaller archives.`);
      }

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!res.ok) {
        let errMsg = `Server returned status ${res.status}`;
        if (res.status === 413) {
          errMsg = 'File is too large. Vercel payload limit is 4.5MB. Please upload a smaller ZIP file, or run the server locally to bypass this limit.';
        } else if (res.status === 504) {
          errMsg = 'Serverless Timeout. The extraction took too long. Please split your ZIP into smaller files or upload them individually.';
        } else {
          try {
            const errJson = await res.json();
            if (errJson.error) errMsg = errJson.error;
          } catch {}
        }
        throw new Error(errMsg);
      }

      const json = await res.json();
      
      const newLogs = [];
      if (json.stdout) {
        newLogs.push(...json.stdout.split('\n'));
      }
      if (json.stderr) {
        newLogs.push(`[SYSTEM ERR] Ingest failed: ${json.stderr}`);
      }
      
      if (json.ok) {
        newLogs.push('[SYSTEM] ZIP archive extraction completed successfully!');
        setToast('ZIP upload and ingest succeeded!');
        setZipResult({
          ok: true,
          message: 'ZIP archive successfully uploaded and extracted! Check the Galleries tab or Lectures page to verify the content.'
        });
        setZipFile(null);
      } else {
        newLogs.push('[SYSTEM] ZIP ingest failed');
        setToast('ZIP ingest failed');
        setZipResult({
          ok: false,
          message: `ZIP extraction failed: ${json.stderr || 'Unknown error during extraction'}`
        });
      }
      setLogs(newLogs.filter(Boolean));
    } catch (err: any) {
      const errMsg = err.message || 'Unknown network error';
      setLogs(prev => [...prev, `[SYSTEM ERR] ZIP upload failed: ${errMsg}`]);
      setToast('ZIP upload and ingest failed');
      setZipResult({
        ok: false,
        message: errMsg
      });
    } finally {
      setIsUploadingZip(false);
    }
  };

  const handleRunLinkSync = async () => {
    const urls = linksText.split('\n').map(u => u.trim()).filter(Boolean);
    if (urls.length === 0) return;

    const token = typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;
    if (!passcode && !token) {
      setToast('Enter passcode or log in');
      return;
    }

    setIsSyncingLinks(true);
    setLogs(['[SYSTEM] Initializing link-list synchronizer...', `[SYSTEM] Processing ${urls.length} URLs...`]);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (passcode) headers['x-admin-passcode'] = passcode;
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${baseApiUrl}/api/v1/integrations/run-link-sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ urls })
      });
      const json = await res.json();
      
      const newLogs = [];
      if (json.stdout) {
        newLogs.push(...json.stdout.split('\n'));
      }
      if (json.stderr) {
        newLogs.push(`[SYSTEM ERR] Link Sync failed: ${json.stderr}`);
      }
      
      if (json.ok) {
        newLogs.push('[SYSTEM] Link synchronization completed successfully!');
        setToast('Links sync succeeded!');
        setLinksText('');
      } else {
        newLogs.push('[SYSTEM] Links sync failed');
        setToast('Links sync failed');
      }
      setLogs(newLogs.filter(Boolean));
    } catch (err: any) {
      setLogs(prev => [...prev, `[SYSTEM ERR] Link sync failed: ${err.message || 'Unknown network error'}`]);
      setToast('Network error triggering Link Sync');
    } finally {
      setIsSyncingLinks(false);
    }
  };

  if (!embedded && (isLoading || isPageLoading)) {
    return (
      <Section background="darker" className="pt-40 min-h-screen flex items-center justify-center">
        <p className="text-white text-xl animate-pulse">Loading Credentials & Integrations console...</p>
      </Section>
    );
  }

  if (!embedded && !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  if (embedded && isPageLoading) {
    return (
      <div className="p-8 border border-white/5 bg-charcoal/50 text-center text-gray-400">
        <p className="animate-pulse">Loading integrations credentials...</p>
      </div>
    );
  }

  const fieldClass =
    'w-full bg-black/50 border border-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:border-gold-500 focus:outline-none transition-colors font-serif';
  const labelClass = 'block text-[10px] uppercase tracking-[0.25em] text-gray-500 mb-2 font-semibold';
  const cardClass = 'border border-white/5 bg-charcoal/30 p-8 flex flex-col justify-between';

  const gridContent = (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      {/* Left Column: Credentials Form */}
      <div className="lg:col-span-2 space-y-8">
        <form onSubmit={handleSave} className="border border-white/5 bg-charcoal/50 p-8 space-y-8">
          <h2 className="font-display text-2xl text-white border-b border-white/5 pb-4">Service Credentials</h2>
          
          {/* Browserless */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className={labelClass}>Browserless.io API Token</label>
              <a
                href="https://www.browserless.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gold-500 hover:underline"
              >
                Get Free Account →
              </a>
            </div>
            <div className="relative">
              <input
                type="password"
                className={fieldClass}
                placeholder="Enter Browserless Token (e.g. 5a1b2c3d-xxxx-xxxx-xxxx-xxxxxxxxxxxx)"
                value={browserlessKey}
                onChange={(e) => setBrowserlessKey(e.target.value)}
              />
            </div>
            <div className="flex gap-4 items-center">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestBrowserless}
                disabled={isTestingBrowserless}
              >
                {isTestingBrowserless ? 'Testing Connection...' : 'Test Browser Connection'}
              </Button>
              
              {browserlessTestResult && (
                <span className={`text-xs ${browserlessTestResult.ok ? 'text-green-500' : 'text-red-500'}`}>
                  {browserlessTestResult.message}
                </span>
              )}
            </div>
          </div>

          <hr className="border-white/5" />

          {/* WhoGoHost Settings */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <label className={labelClass}>WhoGoHost Client Portal credentials</label>
              <span className="text-xs text-gray-500">Used for automated DNS management</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[9px] uppercase tracking-widest text-gray-600 mb-2">Portal Email Address</label>
                <input
                  type="email"
                  className={fieldClass}
                  placeholder="client@whogohost.com"
                  value={whogohostEmail}
                  onChange={(e) => setWhogohostEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase tracking-widest text-gray-600 mb-2">Portal Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={fieldClass}
                    placeholder="••••••••••••••"
                    value={whogohostPassword}
                    onChange={(e) => setWhogohostPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-white"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-white/5" />

          {/* Google Drive Settings */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <label className={labelClass}>Google Drive Automation Sync</label>
              <span className="text-xs text-gray-500">Automate uploads directly from a folder</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[9px] uppercase tracking-widest text-gray-600 mb-2">Folder ID</label>
                <input
                  type="text"
                  className={fieldClass}
                  placeholder="Folder ID from drive.google.com/drive/folders/ID"
                  value={driveFolderId}
                  onChange={(e) => setDriveFolderId(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase tracking-widest text-gray-600 mb-2">Google Cloud API Key (For Shared Folders)</label>
                <input
                  type="password"
                  className={fieldClass}
                  placeholder="Enter API Key (Optional if public folder)"
                  value={driveApiKey}
                  onChange={(e) => setDriveApiKey(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-widest text-gray-600 mb-2">Service Account credentials JSON (Optional for Private Folders)</label>
              <textarea
                className={`${fieldClass} h-24 font-mono text-xs`}
                placeholder='{ "type": "service_account", "project_id": "...", "private_key": "...", ... }'
                value={driveServiceAccountJson}
                onChange={(e) => setDriveServiceAccountJson(e.target.value)}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving Settings...' : 'Save Credentials'}
            </Button>
          </div>
        </form>

        {/* Alternative Ingestion Methods */}
        <div className="border border-white/5 bg-charcoal/50 p-8 space-y-8">
          <h2 className="font-display text-2xl text-white border-b border-white/5 pb-4">Alternative Sync & Ingestion</h2>
          <p className="text-xs text-gray-400 font-light leading-relaxed">
            Ingest resources using folders, direct uploads, or remote links without needing Google Cloud credentials.
          </p>

          {/* Method 1: Public Google Drive Sync */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="block text-[10px] uppercase tracking-[0.25em] text-gold-500 font-semibold">1. Public Google Drive Sync</span>
              <span className="text-[10px] text-gray-500">Requires BROWSERLESS_TOKEN in credentials</span>
            </div>
            <p className="text-xs text-gray-500 font-light leading-relaxed">
              Uses Browserless.io to scrape the file list from the configured public folder ID: <code className="text-white bg-white/5 px-1 font-mono">{driveFolderId || '(Not set)'}</code>.
            </p>
            <div className="flex justify-start">
              <Button
                type="button"
                variant="outline"
                onClick={handleRunPublicDriveSync}
                disabled={isSyncingPublicDrive || isUploadingZip || isSyncingLinks || isSyncingDrive || isRunningSync}
              >
                {isSyncingPublicDrive ? 'Crawling Public Drive...' : 'Sync Public Folder'}
              </Button>
            </div>
          </div>

          <hr className="border-white/5" />

          {/* Method 2: ZIP Archive Ingest */}
          <div className="space-y-4">
            <span className="block text-[10px] uppercase tracking-[0.25em] text-gold-500 font-semibold">2. Direct ZIP Upload</span>
            <p className="text-xs text-gray-500 font-light leading-relaxed">
              Upload a ZIP archive containing media resources. Subfolders like <code className="text-white font-mono bg-white/5 px-1">Gallery/</code>, <code className="text-white font-mono bg-white/5 px-1">Speakers/</code>, or <code className="text-white font-mono bg-white/5 px-1">Lectures/</code> will be parsed and auto-matched dynamically.
            </p>
            <div className="space-y-2">
              <input
                type="file"
                accept=".zip"
                onChange={(e) => setZipFile(e.target.files ? e.target.files[0] : null)}
                className="block w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs file:bg-white/10 file:text-white hover:file:bg-white/20 file:cursor-pointer"
              />
              {zipFile && zipFile.size > 4.5 * 1024 * 1024 && (
                <p className="text-[10px] text-yellow-500">
                  ⚠️ Note: Large ZIP files (&gt; 4.5MB) may exceed serverless execution body limits. Run locally or ingest via direct URLs if timeout occurs.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3 items-start">
              <div className="flex justify-start">
                <Button
                  type="button"
                  onClick={handleZipUpload}
                  disabled={!zipFile || isSyncingPublicDrive || isUploadingZip || isSyncingLinks || isSyncingDrive || isRunningSync}
                >
                  {isUploadingZip ? 'Extracting & Ingesting...' : 'Upload & Extract ZIP'}
                </Button>
              </div>
              
              {zipResult && (
                <div className={`text-xs px-4 py-3 border font-serif w-full ${
                  zipResult.ok 
                    ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                  <div className="font-semibold mb-1">
                    {zipResult.ok ? '🎉 ZIP Extraction Succeeded!' : '❌ ZIP Extraction Failed'}
                  </div>
                  <div className="text-[11px] text-gray-400 font-sans leading-relaxed">
                    {zipResult.message}
                  </div>
                </div>
              )}
            </div>
          </div>

          <hr className="border-white/5" />

          {/* Method 3: Bulk Link Ingestion */}
          <div className="space-y-4">
            <span className="block text-[10px] uppercase tracking-[0.25em] text-gold-500 font-semibold">3. Bulk Direct Link Ingestion</span>
            <p className="text-xs text-gray-500 font-light leading-relaxed">
              Provide a list of direct, public URLs (one per line) pointing to lecture PDFs, audios, videos, or speaker portraits. They will be downloaded and matched.
            </p>
            <textarea
              className={`${fieldClass} h-28 font-mono text-xs`}
              placeholder="https://example.com/downloads/Lecture-2023.pdf&#10;https://archive.org/download/speaker_john_2024.jpg"
              value={linksText}
              onChange={(e) => setLinksText(e.target.value)}
            />
            <div className="flex justify-start">
              <Button
                type="button"
                onClick={handleRunLinkSync}
                disabled={!linksText.trim() || isSyncingPublicDrive || isUploadingZip || isSyncingLinks || isSyncingDrive || isRunningSync}
              >
                {isSyncingLinks ? 'Downloading & Ingesting Links...' : 'Ingest Direct Links'}
              </Button>
            </div>
          </div>
        </div>

        {/* Logs Console */}
        <div ref={logsConsoleRef} className="border border-white/5 bg-black p-8 font-mono text-xs text-green-500 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping"></span>
              <span className="font-semibold text-white tracking-widest uppercase">Remote Job Console</span>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(logs.join('\n')).then(() => setToast('Logs copied'));
                }}
                className="text-[10px] text-gray-500 hover:text-white uppercase tracking-wider transition-colors"
              >
                Copy Output
              </button>
              <button
                onClick={() => setLogs([])}
                className="text-[10px] text-gray-500 hover:text-white uppercase tracking-wider transition-colors"
              >
                Clear Console
              </button>
            </div>
          </div>

          <div className="h-64 overflow-y-auto space-y-2 bg-black/60 p-4 border border-white/5 rounded select-text custom-scrollbar">
            {logs.length === 0 ? (
              <span className="text-white/20 select-none">// No background job active. Run sync below to stream logs...</span>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className={log.startsWith('[ERR]') || log.startsWith('[SYSTEM ERR]') ? 'text-red-500 font-semibold' : 'text-green-500'}>
                  {log}
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end gap-4 pt-2 flex-wrap">
            <Button
              onClick={handleRunSync}
              disabled={isRunningSync || isSyncingDrive}
              variant="outline"
            >
              {isRunningSync ? 'Executing Automated Sync...' : 'Trigger WhoGoHost DNS Sync'}
            </Button>
            <Button
              onClick={handleRunDriveSync}
              disabled={isRunningSync || isSyncingDrive}
              variant="outline"
            >
              {isSyncingDrive ? 'Syncing Google Drive...' : 'Sync Google Drive Folder'}
            </Button>
          </div>
        </div>
      </div>

      {/* Right Column: Zero-Cost Storage Guides */}
      <div className="space-y-8">
        
        {/* Cloudflare R2 Card */}
        <div className={cardClass}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="px-2.5 py-1 text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold uppercase tracking-widest">
                Recommended
              </span>
              <span className="text-xs text-gray-500">10 GB Free</span>
            </div>
            <h3 className="font-display text-xl text-white mb-2">Cloudflare R2</h3>
            <p className="text-gray-500 text-sm leading-relaxed font-light mb-6">
              Perfect for hosting colloquium videos and large PDF booklets. Includes <strong>zero egress fees</strong> so downloads are 100% free regardless of traffic.
            </p>
            <div className="bg-black/20 p-4 border border-white/5 space-y-3 mb-6">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider">How to connect:</div>
              <ol className="text-xs text-gray-500 list-decimal pl-4 space-y-2">
                <li>Log in to your Cloudflare Dashboard.</li>
                <li>Create an R2 Bucket.</li>
                <li>Go to R2 API Tokens and click "Create API Token".</li>
                <li>Set permission to Edit, copy the S3 credentials, and update your environment parameters.</li>
              </ol>
            </div>
          </div>
          <a
            href="https://dash.cloudflare.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center border border-white/10 hover:border-gold-500 py-3 text-xs uppercase tracking-widest text-white hover:text-gold-500 font-semibold transition-all"
          >
            Configure Cloudflare R2
          </a>
        </div>

        {/* Archive.org Card */}
        <div className={cardClass}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="px-2.5 py-1 text-[9px] bg-green-500/10 text-green-400 border border-green-500/20 font-semibold uppercase tracking-widest">
                Unlimited Free
              </span>
              <span className="text-xs text-gray-500">Heritage Archive</span>
            </div>
            <h3 className="font-display text-xl text-white mb-2">Internet Archive</h3>
            <p className="text-gray-500 text-sm leading-relaxed font-light mb-6">
              Absolutely free, permanent storage for educational, historical, and cultural archives. Excellent for uploading massive, high-fidelity colloquium audio lectures and video records.
            </p>
            <div className="bg-black/20 p-4 border border-white/5 space-y-3 mb-6">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider">Usage:</div>
              <p className="text-xs text-gray-500 leading-relaxed font-light">
                Upload your MP3s or PDFs to <a href="https://archive.org" target="_blank" rel="noreferrer" className="text-gold-500 underline">archive.org</a>. Copy the direct link from the "Download Options" panel on your archive item page and paste it directly into the colloquium database item's URL field in the Admin Console.
              </p>
            </div>
          </div>
          <a
            href="https://archive.org/upload/"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center border border-white/10 hover:border-gold-500 py-3 text-xs uppercase tracking-widest text-white hover:text-gold-500 font-semibold transition-all"
          >
            Upload to Archive.org
          </a>
        </div>

        {/* Google Drive Card */}
        <div className={cardClass}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="px-2.5 py-1 text-[9px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-semibold uppercase tracking-widest">
                Simple Links
              </span>
              <span className="text-xs text-gray-500">15 GB Free</span>
            </div>
            <h3 className="font-display text-xl text-white mb-2">Google Drive</h3>
            <p className="text-gray-500 text-sm leading-relaxed font-light mb-6">
              Easy storage for documents. You can obtain direct download links directly by translating standard shared link formats.
            </p>
            <div className="bg-black/20 p-4 border border-white/5 space-y-3 mb-6">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider">Direct Link format:</div>
              <div className="text-xs text-gray-400 font-mono break-all leading-normal bg-black/40 p-2 border border-white/5">
                https://drive.google.com/uc?export=download&id=YOUR_FILE_ID
              </div>
              <p className="text-xs text-gray-500 leading-relaxed font-light">
                Replace <code className="text-white font-mono bg-white/5 px-1">YOUR_FILE_ID</code> with the ID extracted from the share link's URL.
              </p>
            </div>
          </div>
          <a
            href="https://drive.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center border border-white/10 hover:border-gold-500 py-3 text-xs uppercase tracking-widest text-white hover:text-gold-500 font-semibold transition-all"
          >
            Go to Google Drive
          </a>
        </div>

      </div>

    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-6 mt-4">
        {message && (
          <div className="bg-gold-500/10 border border-gold-500/20 px-4 py-2 text-gold-500 text-xs tracking-wider uppercase">
            {message}
          </div>
        )}
        {gridContent}
      </div>
    );
  }

  return (
    <Section background="darker" className="pt-36 pb-16 min-h-screen">
      <div className="container mx-auto px-6">
        
        {/* Back Link */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin/console')}
            className="text-gold-500 hover:text-gold-400 transition-colors uppercase tracking-[0.2em] text-xs font-semibold flex items-center gap-2"
          >
            ← Back to Admin Console
          </button>
        </div>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b border-white/5 pb-8">
          <div>
            <h1 className="font-display text-5xl text-white mb-3">Integrations & Automation</h1>
            <p className="text-gray-400 font-light max-w-3xl leading-relaxed">
              Securely store credentials, configure zero-cost remote runners, and trigger autonomous background jobs.
            </p>
          </div>
          {message && (
            <div className="bg-gold-500/10 border border-gold-500/20 px-4 py-2 text-gold-500 text-xs tracking-wider uppercase">
              {message}
            </div>
          )}
        </div>

        {gridContent}
      </div>
    </Section>
  );
};
