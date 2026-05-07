const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'heritage-colloquium-media';

let awsPromise = null;
let s3ClientPromise = null;

async function loadAws() {
  if (awsPromise) return awsPromise;
  awsPromise = (async () => {
    const [{ S3Client, PutObjectCommand }, { getSignedUrl }] = await Promise.all([
      import('@aws-sdk/client-s3'),
      import('@aws-sdk/s3-request-presigner'),
    ]);
    return { S3Client, PutObjectCommand, getSignedUrl };
  })();
  return awsPromise;
}

async function getS3Client() {
  if (s3ClientPromise) return s3ClientPromise;
  s3ClientPromise = (async () => {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('S3 is not configured (missing AWS credentials)');
    }
    const { S3Client } = await loadAws();
    return new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: { accessKeyId, secretAccessKey },
    });
  })();
  return s3ClientPromise;
}

/**
 * Generates a presigned URL for uploading a file to S3.
 * @param {string} key - The S3 object key (filename).
 * @param {string} contentType - The MIME type of the file.
 * @param {number} expiresIn - Expiration time in seconds (default: 300).
 * @returns {Promise<string>} - The presigned URL.
 */
export async function generatePresignedUrl(key, contentType, expiresIn = 300) {
  const { PutObjectCommand, getSignedUrl } = await loadAws();
  const s3Client = await getS3Client();
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

export function getPublicUrl(key) {
  // If using CloudFront, replace with CloudFront domain
  if (process.env.CDN_DOMAIN) {
    return `https://${process.env.CDN_DOMAIN}/${key}`;
  }
  return `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;
}
