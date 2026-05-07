import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const mediaQueue = new Queue('media-processing', { connection });

export function createMediaWorker(processor) {
  return new Worker('media-processing', processor, { connection });
}
