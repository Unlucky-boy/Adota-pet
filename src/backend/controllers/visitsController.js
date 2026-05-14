const db = require('../config/db');

const visitsController = {
  // GET /admin/visits — Lista de visitas agendadas
  async list(req, res) {
    try {
      const result = await db.query(`
        SELECT
          v.*,
          a.adopter_name,
          a.adopter_email,
          a.adopter_phone,
          p.name AS pet_name,
          p.species AS pet_species,
          u.name AS scheduled_by_name
        FROM visits v
        JOIN adoptions a ON a.id = v.adoption_id
        JOIN pets p ON p.id = a.pet_id
        LEFT JOIN users u ON u.id = v.scheduled_by
        ORDER BY v.visit_date ASC, v.visit_time ASC
      `);

      res.render('admin/visits', {
        title: 'Agendamentos de Visita — Adota Pet',
        visits: result.rows,
      });
    } catch (err) {
      console.error('Erro ao listar visitas:', err);
      res.render('admin/visits', {
        title: 'Agendamentos de Visita',
        visits: [],
      });
    }
  },

  // GET /admin/visits/new — Formulário de agendamento
  async newForm(req, res) {
    try {
      // Buscar adoções pendentes ou aprovadas (que podem receber visita)
      const adoptionsResult = await db.query(`
        SELECT a.id, a.adopter_name, a.adopter_email, a.status AS adoption_status,
               p.name AS pet_name, p.species AS pet_species
        FROM adoptions a
        JOIN pets p ON p.id = a.pet_id
        WHERE a.status IN ('pending', 'approved')
        ORDER BY a.created_at DESC
      `);

      res.render('admin/visit-form', {
        title: 'Agendar Visita — Adota Pet',
        adoptions: adoptionsResult.rows,
        formData: req.session.formData || {},
      });
      delete req.session.formData;
    } catch (err) {
      console.error('Erro ao carregar formulário de visita:', err);
      req.session.error = 'Erro ao carregar dados.';
      return res.redirect('/admin/visits');
    }
  },

  // POST /admin/visits — Criar agendamento
  async create(req, res) {
    const { adoption_id, visit_date, visit_time, visit_type, notes } = req.body;

    req.session.formData = { adoption_id, visit_date, visit_time, visit_type, notes };

    // Validações
    if (!adoption_id || !visit_date || !visit_time) {
      req.session.error = 'Adoção, data e horário são obrigatórios.';
      return res.redirect('/admin/visits/new');
    }

    // Validar data futura
    const visitDateTime = new Date(`${visit_date}T${visit_time}`);
    if (visitDateTime <= new Date()) {
      req.session.error = 'A data e horário devem ser futuros.';
      return res.redirect('/admin/visits/new');
    }

    // Validar tipo
    const validTypes = ['home_visit', 'interview'];
    if (visit_type && !validTypes.includes(visit_type)) {
      req.session.error = 'Tipo de visita inválido.';
      return res.redirect('/admin/visits/new');
    }

    try {
      // Verificar se adoção existe
      const adoptionCheck = await db.query(
        'SELECT id FROM adoptions WHERE id = $1',
        [adoption_id]
      );
      if (adoptionCheck.rows.length === 0) {
        req.session.error = 'Solicitação de adoção não encontrada.';
        return res.redirect('/admin/visits/new');
      }

      await db.query(
        `INSERT INTO visits (adoption_id, visit_date, visit_time, visit_type, notes, scheduled_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          adoption_id,
          visit_date,
          visit_time,
          visit_type || 'home_visit',
          notes ? notes.trim() : null,
          req.session.user.id,
        ]
      );

      delete req.session.formData;
      req.session.success = 'Visita agendada com sucesso!';
      return res.redirect('/admin/visits');
    } catch (err) {
      console.error('Erro ao agendar visita:', err);
      req.session.error = 'Erro ao agendar visita. Tente novamente.';
      return res.redirect('/admin/visits/new');
    }
  },

  // POST /admin/visits/:id/status — Atualizar status
  async updateStatus(req, res) {
    const { status } = req.body;
    const validStatuses = ['scheduled', 'completed', 'cancelled'];

    if (!validStatuses.includes(status)) {
      req.session.error = 'Status inválido.';
      return res.redirect('/admin/visits');
    }

    try {
      await db.query(
        'UPDATE visits SET status = $1 WHERE id = $2',
        [status, req.params.id]
      );

      const statusLabel = {
        scheduled: 'reagendada',
        completed: 'marcada como concluída',
        cancelled: 'cancelada',
      };

      req.session.success = `Visita ${statusLabel[status]}!`;
      return res.redirect('/admin/visits');
    } catch (err) {
      console.error('Erro ao atualizar visita:', err);
      req.session.error = 'Erro ao atualizar visita.';
      return res.redirect('/admin/visits');
    }
  },
};

module.exports = visitsController;
