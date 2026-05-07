export async function uploadFile(
  file: File,
  passcode: string,
  apiBaseUrl: string = '',
  title?: string
): Promise<{ ok: boolean; item?: any; error?: string }> {
  // 1. Try to get presigned URL
  try {
    const presignedRes = await fetch(`${apiBaseUrl}/api/v1/media/presigned`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-admin-passcode': passcode 
      },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type
      })
    });
    
    if (presignedRes.ok) {
      const { url, key, publicUrl } = await presignedRes.json();
      
      // 2. Upload to S3
      const uploadRes = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });
      
      if (!uploadRes.ok) throw new Error('S3 Upload failed');
      
      // 3. Register media
      const type = file.type.startsWith('image/') ? 'image' 
                 : file.type.startsWith('video/') ? 'video'
                 : file.type.startsWith('audio/') ? 'audio'
                 : 'file';

      const registerRes = await fetch(`${apiBaseUrl}/api/v1/media`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-passcode': passcode 
        },
        body: JSON.stringify({
          type,
          title: (typeof title === 'string' && title.trim()) ? title.trim() : file.name,
          url: publicUrl,
          s3Key: key,
          sizeBytes: file.size,
          mimeType: file.type
        })
      });
      
      return await registerRes.json();
    }
  } catch (e) {
    console.warn('S3 upload failed or not configured, falling back to legacy upload', e);
  }

  // Fallback to legacy upload
  const formData = new FormData();
  formData.append('file', file);
  if (typeof title === 'string' && title.trim()) formData.append('title', title.trim());
  
  const res = await fetch(`${apiBaseUrl}/api/v1/media/upload`, {
    method: 'POST',
    headers: { 'x-admin-passcode': passcode },
    body: formData
  });
  
  return await res.json();
}
