const db = require('../config/db');

const volunteersController = {
  // GET /volunteer — Formulário público de inscrição
  formPage(req, res) {
    res.render('volunteer/form', {
      title: 'Seja Voluntário — Adota Pet',
      formData: req.session.formData || {},
    });
    delete req.session.formData;
  },

  // POST /volunteer — Processar inscrição
  async register(req, res) {
    const { name, email, phone, availability, motivation } = req.body;

    // Preservar dados em caso de erro
    req.session.formData = { name, email, phone, availability, motivation };

    // Validações
    if (!name || !email || !phone || !availability) {
      req.session.error = 'Nome, e-mail, telefone e disponibilidade são obrigatórios.';
      return res.redirect('/volunteer');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      req.session.error = 'E-mail inválido. Verifique e tente novamente.';
      return res.redirect('/volunteer');
    }

    try {
      // Verificar e-mail duplicado
      const emailCheck = await db.query(
        'SELECT id FROM volunteers WHERE email = $1',
        [email.toLowerCase().trim()]
      );
      if (emailCheck.rows.length > 0) {
        req.session.error = 'Este e-mail já possui uma inscrição de voluntariado.';
        return res.redirect('/volunteer');
      }

      // Inserir voluntário
      await db.query(
        `INSERT INTO volunteers (name, email, phone, availability, motivation)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          name.trim(),
          email.toLowerCase().trim(),
          phone.trim(),
          availability.trim(),
          motivation ? motivation.trim() : null,
        ]
      );

      delete req.session.formData;
      req.session.success = 'Inscrição de voluntariado enviada com sucesso!';
      return res.redirect('/volunteer/success');
    } catch (err) {
      console.error('Erro ao cadastrar voluntário:', err);
      req.session.error = 'Erro interno. Tente novamente mais tarde.';
      return res.redirect('/volunteer');
    }
  },

  // GET /volunteer/success — Confirmação
  successPage(req, res) {
    res.render('volunteer/success', {
      title: 'Inscrição Enviada — Adota Pet',
    });
  },

  // =============================================
  // ADMIN — US16 (Aprovação de Voluntário)
  // =============================================

  // GET /admin/volunteers — Lista de voluntários
  async adminList(req, res) {
    try {
      const statusFilter = req.query.status || 'all';
      let query = `
        SELECT v.*, u.name AS reviewer_name
        FROM volunteers v
        LEFT JOIN users u ON u.id = v.reviewed_by
      `;
      const params = [];

      if (statusFilter !== 'all') {
        query += ' WHERE v.status = $1';
        params.push(statusFilter);
      }

      query += ' ORDER BY v.created_at DESC';

      const result = await db.query(query, params);

      // Contadores por status
      const countResult = await db.query(`
        SELECT status, COUNT(*)::int AS count
        FROM volunteers
        GROUP BY status
      `);
      const counts = { pending: 0, approved: 0, rejected: 0, total: 0 };
      countResult.rows.forEach((r) => {
        counts[r.status] = r.count;
        counts.total += r.count;
      });

      res.render('admin/volunteers', {
        title: 'Gerenciar Voluntários — Adota Pet',
        volunteers: result.rows,
        statusFilter,
        counts,
      });
    } catch (err) {
      console.error('Erro ao listar voluntários:', err);
      res.render('admin/volunteers', {
        title: 'Gerenciar Voluntários',
        volunteers: [],
        statusFilter: 'all',
        counts: { pending: 0, approved: 0, rejected: 0, total: 0 },
      });
    }
  },

  // POST /admin/volunteers/:id/status — Aprovar ou Rejeitar
  async updateStatus(req, res) {
    const { status } = req.body;
    const volunteerId = req.params.id;
    const validStatuses = ['approved', 'rejected', 'pending'];

    if (!validStatuses.includes(status)) {
      req.session.error = 'Status inválido.';
      return res.redirect('/admin/volunteers');
    }

    try {
      await db.query(
        `UPDATE volunteers
         SET status = $1, reviewed_by = $2, reviewed_at = NOW()
         WHERE id = $3`,
        [status, req.session.user.id, volunteerId]
      );

      const statusLabel = {
        approved: 'aprovado',
        rejected: 'rejeitado',
        pending: 'marcado como pendente',
      };

      req.session.success = `Voluntário ${statusLabel[status]} com sucesso!`;
      return res.redirect('/admin/volunteers');
    } catch (err) {
      console.error('Erro ao atualizar status do voluntário:', err);
      req.session.error = 'Erro ao atualizar status.';
      return res.redirect('/admin/volunteers');
    }
  },
};

module.exports = volunteersController;
