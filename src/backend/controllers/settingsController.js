const db = require('../config/db');

const settingsController = {
  // GET /admin/settings — Página de configurações
  async settingsPage(req, res) {
    try {
      const result = await db.query('SELECT key, value FROM settings');
      const settings = {};
      result.rows.forEach((row) => {
        settings[row.key] = row.value;
      });

      res.render('admin/settings', {
        title: 'Configurações — Adota Pet',
        settings,
      });
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
      res.render('admin/settings', {
        title: 'Configurações',
        settings: { pix_key: '', project_email: '' },
      });
    }
  },

  // POST /admin/settings — Salvar configurações
  async saveSettings(req, res) {
    const { pix_key, project_email } = req.body;

    try {
      // Upsert para cada configuração
      await db.query(
        `INSERT INTO settings (key, value, updated_at) VALUES ('pix_key', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [pix_key ? pix_key.trim() : '']
      );

      await db.query(
        `INSERT INTO settings (key, value, updated_at) VALUES ('project_email', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [project_email ? project_email.trim() : '']
      );

      req.session.success = 'Configurações salvas com sucesso!';
      return res.redirect('/admin/settings');
    } catch (err) {
      console.error('Erro ao salvar configurações:', err);
      req.session.error = 'Erro ao salvar configurações.';
      return res.redirect('/admin/settings');
    }
  },

  // Método utilitário — buscar todas as configurações
  async getAll() {
    const result = await db.query('SELECT key, value FROM settings');
    const settings = {};
    result.rows.forEach((row) => {
      settings[row.key] = row.value;
    });
    return settings;
  },
};

module.exports = settingsController;
