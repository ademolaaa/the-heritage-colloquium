import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

console.log('Connecting to DATABASE_URL:', process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function main() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('Database connection successful!');
    console.log('Database time:', res.rows[0]);
    
    // Check if tables exist
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Found tables:', tables.rows.map(r => r.table_name));
  } catch (err) {
    console.error('Database connection failed:', err.message);
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
