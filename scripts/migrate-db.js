require('dotenv').config();

const fs = require('fs');
const path = require('path');
const db = require('../src/backend/config/db');

async function migrate() {
  const seedPath = path.join(__dirname, '..', 'src', 'backend', 'config', 'seed.sql');
  const sql = fs.readFileSync(seedPath, 'utf8');

  try {
    await db.pool.query('BEGIN');
    const petsTable = await db.pool.query("SELECT to_regclass('public.pets') AS table_name");
    if (petsTable.rows[0].table_name) {
      await db.pool.query(`
        WITH duplicate_pets AS (
          SELECT id,
                 MIN(id) OVER (
                   PARTITION BY name, species, breed, age_months, size, gender
                 ) AS keep_id
          FROM pets
        )
        UPDATE adoptions a
        SET pet_id = d.keep_id
        FROM duplicate_pets d
        WHERE a.pet_id = d.id AND d.id <> d.keep_id
      `);
      await db.pool.query(`
        DELETE FROM pets p
        USING pets keeper
        WHERE p.id > keeper.id
          AND p.name = keeper.name
          AND p.species = keeper.species
          AND p.breed IS NOT DISTINCT FROM keeper.breed
          AND p.age_months IS NOT DISTINCT FROM keeper.age_months
          AND p.size IS NOT DISTINCT FROM keeper.size
          AND p.gender IS NOT DISTINCT FROM keeper.gender
      `);
      await db.pool.query('DROP INDEX IF EXISTS uq_pets_seed_identity');
    }
    await db.pool.query(sql);
    await db.pool.query('COMMIT');
    console.log('Banco atualizado com sucesso a partir do seed.sql.');
  } catch (err) {
    await db.pool.query('ROLLBACK');
    throw err;
  } finally {
    await db.pool.end();
  }
}

migrate().catch((err) => {
  console.error('Erro ao atualizar o banco:', err.message);
  process.exitCode = 1;
});
