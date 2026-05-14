require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5433,
  user: process.env.DB_USER || 'adotapet',
  password: process.env.DB_PASSWORD || 'adotapet123',
  database: process.env.DB_NAME || 'adotapet',
});

async function migrate() {
  try {
    console.log('🔄 Iniciando migração: image_url → image_data + image_mime_type...\n');

    // Verificar se a coluna image_data já existe
    const check = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'pets' AND column_name = 'image_data'"
    );

    if (check.rows.length > 0) {
      console.log('✅ A coluna image_data já existe. Migração não necessária.');
      return;
    }

    await pool.query('BEGIN');

    // 1. Adicionar novas colunas
    console.log('1️⃣  Adicionando coluna image_data (BYTEA)...');
    await pool.query('ALTER TABLE pets ADD COLUMN image_data BYTEA');

    console.log('2️⃣  Adicionando coluna image_mime_type (VARCHAR)...');
    await pool.query('ALTER TABLE pets ADD COLUMN image_mime_type VARCHAR(50)');

    // 3. Remover a coluna antiga
    console.log('3️⃣  Removendo coluna image_url...');
    await pool.query('ALTER TABLE pets DROP COLUMN image_url');

    await pool.query('COMMIT');

    console.log('\n✅ Migração concluída com sucesso!');
    console.log('   - Coluna image_url removida');
    console.log('   - Coluna image_data (BYTEA) adicionada');
    console.log('   - Coluna image_mime_type (VARCHAR) adicionada');
    console.log('\n📌 Os pets existentes ficaram sem imagem. Faça upload via painel admin.');

    // Verificar resultado
    const res = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'pets' ORDER BY ordinal_position"
    );
    console.log('\nSchema atualizado:');
    res.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('❌ Erro na migração:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
