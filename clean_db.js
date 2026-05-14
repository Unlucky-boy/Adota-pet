require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5433,
  user: process.env.DB_USER || 'adotapet',
  password: process.env.DB_PASSWORD || 'adotapet123',
  database: process.env.DB_NAME || 'adotapet',
});

async function cleanDB() {
  try {
    await pool.query('BEGIN');
    
    // Delete data from all tables
    await pool.query('DELETE FROM visits');
    await pool.query('DELETE FROM adoptions');
    await pool.query('DELETE FROM pets');
    await pool.query('DELETE FROM donations');
    await pool.query('DELETE FROM adopters');
    await pool.query('DELETE FROM volunteers');
    await pool.query('DELETE FROM settings');
    
    // Delete all users EXCEPT the admin
    await pool.query("DELETE FROM users WHERE email != 'admin@lovep.com'");
    
    // Reset sequences (optional but nice)
    await pool.query('ALTER SEQUENCE visits_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE adoptions_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE pets_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE donations_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE adopters_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE volunteers_id_seq RESTART WITH 1');

    await pool.query('COMMIT');
    console.log('Database cleaned successfully. Only admin@lovep.com remains in the users table.');
  } catch (e) {
    await pool.query('ROLLBACK');
    console.error('Error cleaning database:', e);
  } finally {
    await pool.end();
  }
}

cleanDB();
