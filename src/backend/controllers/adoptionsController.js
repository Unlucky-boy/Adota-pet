const db = require('../config/db');

const adoptionsController = {
  // POST /adoptions — Enviar solicitação
  async create(req, res) {
    const { pet_id, adopter_name, adopter_email, adopter_phone, adopter_address, message } = req.body;

    try {
      // Verificar se pet existe e está disponível
      const petResult = await db.query(
        "SELECT * FROM pets WHERE id = $1 AND status = 'available'",
        [pet_id]
      );

      if (petResult.rows.length === 0) {
        req.session.error = 'Este pet não está mais disponível para adoção.';
        return res.redirect('/pets');
      }

      await db.query(
        `INSERT INTO adoptions (pet_id, adopter_name, adopter_email, adopter_phone, adopter_address, message)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [pet_id, adopter_name, adopter_email, adopter_phone, adopter_address, message]
      );

      req.session.success = 'Solicitação de adoção enviada com sucesso! Entraremos em contato.';
      res.redirect('/adoptions/success');
    } catch (err) {
      console.error('Erro ao criar solicitação:', err);
      req.session.error = 'Erro ao enviar solicitação. Tente novamente.';
      res.redirect(`/pets/${pet_id}`);
    }
  },

  // GET /adoptions/success — Página de confirmação
  success(req, res) {
    res.render('adoptions/success', { title: 'Solicitação Enviada — Adota Pet' });
  },

  // GET /admin/adoptions — Dashboard de adoções (ONG)
  async adminList(req, res) {
    try {
      const result = await db.query(
        `SELECT a.*, p.name AS pet_name, p.species AS pet_species
         FROM adoptions a
         JOIN pets p ON p.id = a.pet_id
         ORDER BY a.created_at DESC`
      );
      res.render('admin/adoptions', {
        title: 'Gerenciar Adoções — Adota Pet',
        adoptions: result.rows,
      });
    } catch (err) {
      console.error('Erro ao listar adoções:', err);
      res.render('admin/adoptions', { title: 'Gerenciar Adoções', adoptions: [] });
    }
  },

  // POST /admin/adoptions/:id/status — Aprovar/Rejeitar
  async updateStatus(req, res) {
    const { status } = req.body;
    const validStatuses = ['approved', 'rejected', 'pending'];

    if (!validStatuses.includes(status)) {
      req.session.error = 'Status inválido.';
      return res.redirect('/admin/adoptions');
    }

    try {
      const result = await db.query(
        'UPDATE adoptions SET status = $1 WHERE id = $2 RETURNING pet_id',
        [status, req.params.id]
      );

      // Se aprovada, reservar o pet
      if (status === 'approved' && result.rows.length > 0) {
        await db.query(
          "UPDATE pets SET status = 'reserved' WHERE id = $1",
          [result.rows[0].pet_id]
        );
      }

      const statusLabel = {
        approved: 'aprovada',
        rejected: 'rejeitada',
        pending: 'marcada como pendente',
      };

      req.session.success = `Solicitação ${statusLabel[status]}!`;
      res.redirect('/admin/adoptions');
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      req.session.error = 'Erro ao atualizar status.';
      res.redirect('/admin/adoptions');
    }
  },
};

module.exports = adoptionsController;
