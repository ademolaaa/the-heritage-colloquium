import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = 'heritage-media';

/**
 * Upload a buffer to Supabase Storage and return the public URL.
 * @param {Buffer} buffer - File data
 * @param {string} storagePath - Path within the bucket e.g. "audios/med_abc123.mp3"
 * @param {string} mimeType - MIME type of the file
 */
export async function uploadToStorage(buffer, storagePath, mimeType) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return { publicUrl: data.publicUrl, storagePath, bucket: BUCKET };
}

/**
 * Delete a file from Supabase Storage.
 * @param {string} storagePath - Path within the bucket
 */
export async function deleteFromStorage(storagePath) {
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) console.error('Storage delete failed:', error.message);
}
