import 'dotenv/config';
import dns from 'node:dns';

// Monkey-patch DNS lookup to bypass local DNS server failure for Supabase host
const originalLookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (hostname === 'aws-0-eu-west-1.pooler.supabase.com') {
    if (options && options.all) {
      return callback(null, [{ address: '52.209.89.87', family: 4 }]);
    }
    return callback(null, '52.209.89.87', 4);
  }
  return originalLookup(hostname, options, callback);
};

import { initDb } from '../server/lib/postgres.js';

async function run() {
  console.log('Connecting and initializing database schema...');
  try {
    await initDb();
    console.log('✅ Database schema initialized successfully!');
  } catch (err) {
    console.error('❌ Database schema initialization failed:', err);
    process.exit(1);
  }
}

run();
