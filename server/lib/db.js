import { db as pg } from './postgres.js';
import { createId, nowIso } from './jsonStore.js';

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

/**
 * A Postgres-backed adapter that mimics the JSON store interface.
 * This allows for a smooth migration to Supabase/Vercel.
 */
export function createDb() {
  async function init() {
    // Schema is initialized in postgres.js
  }

  async function readTable(tableName) {
    try {
      // Handle camelCase table names for SQL (publications vs pressReleases)
      const sqlTableName = tableName.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      const result = await pg.query(`SELECT * FROM ${sqlTableName}`);
      return result.rows;
    } catch (err) {
      console.error(`Error reading table ${tableName}:`, err);
      return [];
    }
  }

  async function writeTable(tableName, value) {
    try {
      const sqlTableName = tableName.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      
      // For a "lazy" migration that keeps the JSON logic, we store as JSONB 
      // or we properly map. For now, let's assume we want to preserve the data.
      // Better approach: Since we are moving to proper SQL, we should ideally
      // have specific INSERT/UPDATE queries. But to keep the writeTable(table, items)
      // pattern, we'll do a TRUNCATE + INSERT (only for small tables/site settings).
      
      // TODO: Implement proper SQL mapping for each table if performance is an issue.
      // For siteSettings, it's easy:
      if (tableName === 'siteSettings') {
        const data = Array.isArray(value) ? value[0] : value;
        await pg.query(
          'INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = $3',
          ['main', data, nowIso()]
        );
        return;
      }

      console.warn(`writeTable for ${tableName} called. Full table sync is discouraged in SQL.`);
      // For other tables, we'd need a more complex sync or individual routes.
    } catch (err) {
      console.error(`Error writing table ${tableName}:`, err);
    }
  }

  return { init, readTable, writeTable };
}
