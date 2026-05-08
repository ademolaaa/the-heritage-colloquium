import { SiteContent } from '../types';
import { supabase } from './supabase';

export async function fetchRemoteContent(url: string): Promise<unknown> {
  const { data, error } = await supabase
    .from('site_settings')
    .select('content')
    .eq('id', 1)
    .single();

  if (error) {
    // If the table is empty or missing, just return null so it falls back to defaults
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Fetch error:', error.message);
    throw new Error(error.message);
  }
  return data?.content;
}

export async function publishRemoteContent(url: string, content: SiteContent, passcode: string): Promise<void> {
  const { error } = await supabase
    .from('site_settings')
    .upsert({ id: 1, content });

  if (error) {
    throw new Error(error.message);
  }
}

export async function rotateRemotePasscode(url: string, currentPasscode: string, newPasscode: string): Promise<void> {
  // Note: Since we moved to Supabase Auth, manual passcodes are no longer needed here.
  return Promise.resolve();
}
