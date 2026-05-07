// Fix: Cast import.meta to any to resolve "Property 'env' does not exist on type 'ImportMeta'"
const env = (import.meta as any).env;

export const config = {
  apiBaseUrl: env?.VITE_API_URL || 'https://api.ahiajoku.im.gov.ng',
  s3BucketUrl: env?.VITE_S3_URL || 'https://media.ahiajoku.im.gov.ng',
  features: {
    enablePatternBackgrounds: true,
    enableMotion: true,
  },
  contact: {
    email: 'secretariat@ahiajoku.im.gov.ng',
    phone: '+234 (0) 800 HERITAGE',
    address: 'The Heritage Council Wing, State Cultural Centre, New Owerri Capital District',
  }
};