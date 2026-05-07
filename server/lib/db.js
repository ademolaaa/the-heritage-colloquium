import path from 'node:path';
import { ensureDir, readJsonFile, writeJsonFileAtomic } from './jsonStore.js';

export const TABLE_NAMES = [
  'lectures',
  'events',
  'media',
  'publications',
  'pressReleases',
  'socialLinks',
  'gallery',
  'contributors',
  'navigationMenu',
  'siteSettings',
  'posts',
  'comments',
  'likes',
  'questions',
  'answers',
];

export function createDb({ dataDir }) {
  const tablesDir = path.join(dataDir, 'tables');

  function tableFile(tableName) {
    return path.join(tablesDir, `${tableName}.json`);
  }

  async function init() {
    await ensureDir(tablesDir);
    for (const name of TABLE_NAMES) {
      const file = tableFile(name);
      const exists = await readJsonFile(file, null).catch(() => null);
      if (exists !== null) continue;
      if (name === 'siteSettings') {
        await writeJsonFileAtomic(file, { id: 'site', updatedAt: null, data: {} });
      } else {
        await writeJsonFileAtomic(file, []);
      }
    }
  }

  async function readTable(tableName) {
    await init();
    return await readJsonFile(tableFile(tableName), tableName === 'siteSettings' ? { id: 'site', updatedAt: null, data: {} } : []);
  }

  async function writeTable(tableName, value) {
    await init();
    await writeJsonFileAtomic(tableFile(tableName), value);
  }

  return { dataDir, tablesDir, init, readTable, writeTable };
}

