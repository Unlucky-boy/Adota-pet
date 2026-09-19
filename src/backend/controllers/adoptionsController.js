const db = require('../config/db');

const adoptionsController = {
  // POST /adoptions — Enviar solicitação
  async create(req, res) {
    let { pet_id, adopter_name, adopter_email, adopter_phone, adopter_address, message } = req.body;

    try {
      // Se estiver logado, puxar os dados completos do banco caso não venham no formulário
      if (req.session.adopter && (!adopter_phone || !adopter_address)) {
        const adopterData = await db.query('SELECT phone, address FROM adopters WHERE id = $1', [req.session.adopter.id]);
        if (adopterData.rows.length > 0) {
          adopter_phone = adopter_phone || adopterData.rows[0].phone;
          adopter_address = adopter_address || adopterData.rows[0].address;
          message = message || 'Intenção de adoção registrada via sistema (Usuário Logado).';
        }
      }

      // Verificar se pet existe e está disponível
      const petResult = await db.query(
        "SELECT * FROM pets WHERE id = $1 AND status = 'available'",
        [pet_id]
      );

      if (petResult.rows.length === 0) {
        req.session.error = 'Este pet não está mais disponível para adoção.';
        return res.redirect('/pets');
      }

      const adoptionResult = await db.query(
        `INSERT INTO adoptions (pet_id, adopter_name, adopter_email, adopter_phone, adopter_address, message)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [pet_id, adopter_name, adopter_email, adopter_phone, adopter_address, message]
      );
      await db.query(
        `INSERT INTO adoption_status_history (adoption_id, new_status)
         VALUES ($1, 'pending')`,
        [adoptionResult.rows[0].id]
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
    const validStatuses = ['pending', 'under_review', 'interview', 'visit', 'approved', 'rejected', 'cancelled'];

    if (!validStatuses.includes(status)) {
      req.session.error = 'Status inválido.';
      return res.redirect('/admin/adoptions');
    }

    try {
      const result = await db.transaction(async (client) => {
        const adoptionResult = await client.query(
          `SELECT a.id, a.pet_id, a.status AS adoption_status, p.status AS pet_status
           FROM adoptions a
           JOIN pets p ON p.id = a.pet_id
           WHERE a.id = $1
           FOR UPDATE OF a, p`,
          [req.params.id]
        );

        if (adoptionResult.rows.length === 0) {
          return { notFound: true };
        }

        const adoption = adoptionResult.rows[0];

        if (status === 'approved') {
          if (adoption.pet_status !== 'available' &&
              !(adoption.adoption_status === 'approved' && adoption.pet_status === 'reserved')) {
            return { conflict: true };
          }

          const competingApproval = await client.query(
            `SELECT id FROM adoptions
             WHERE pet_id = $1 AND status = 'approved' AND id <> $2
             FOR UPDATE`,
            [adoption.pet_id, adoption.id]
          );

          if (competingApproval.rows.length > 0) {
            return { conflict: true };
          }

          await client.query(
            'UPDATE adoptions SET status = $1 WHERE id = $2',
            [status, adoption.id]
          );
          await client.query(
            "UPDATE pets SET status = 'reserved' WHERE id = $1",
            [adoption.pet_id]
          );
          await client.query(
            `WITH rejected AS (
               UPDATE adoptions SET status = 'rejected'
               WHERE pet_id = $1 AND id <> $2 AND status = 'pending'
               RETURNING id
             )
             INSERT INTO adoption_status_history (adoption_id, old_status, new_status, changed_by, note)
             SELECT id, 'pending', 'rejected', $3, 'Outra solicitação foi aprovada para este pet'
             FROM rejected`,
            [adoption.pet_id, adoption.id, req.session.user.id]
          );
          await client.query(
            `INSERT INTO adoption_status_history (adoption_id, old_status, new_status, changed_by)
             VALUES ($1, $2, $3, $4)`,
            [adoption.id, adoption.adoption_status, status, req.session.user.id]
          );
          await client.query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
             VALUES ($1, 'adoption_status_changed', 'adoption', $2, $3::jsonb)`,
            [req.session.user.id, adoption.id, JSON.stringify({ oldStatus: adoption.adoption_status, newStatus: status })]
          );
          return { updated: true };
        }

        await client.query(
          'UPDATE adoptions SET status = $1 WHERE id = $2',
          [status, adoption.id]
        );

        if (adoption.adoption_status === 'approved' && adoption.pet_status === 'reserved') {
          await client.query(
            "UPDATE pets SET status = 'available' WHERE id = $1",
            [adoption.pet_id]
          );
        }

        await client.query(
          `INSERT INTO adoption_status_history (adoption_id, old_status, new_status, changed_by)
           VALUES ($1, $2, $3, $4)`,
          [adoption.id, adoption.adoption_status, status, req.session.user.id]
        );
        await client.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, 'adoption_status_changed', 'adoption', $2, $3::jsonb)`,
          [req.session.user.id, adoption.id, JSON.stringify({ oldStatus: adoption.adoption_status, newStatus: status })]
        );

        return { updated: true };
      });

      if (result.notFound) {
        req.session.error = 'Solicitação de adoção não encontrada.';
        return res.redirect('/admin/adoptions');
      }

      if (result.conflict) {
        req.session.error = 'Este pet não está disponível para aprovação.';
        return res.redirect('/admin/adoptions');
      }

      const statusLabel = {
        under_review: 'em análise',
        interview: 'marcada para entrevista',
        visit: 'marcada para visita',
        approved: 'aprovada',
        rejected: 'rejeitada',
        cancelled: 'cancelada',
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

  async details(req, res) {
    try {
      const [adoptionResult, historyResult, checklistResult] = await Promise.all([
        db.query(
          `SELECT a.*, p.name AS pet_name, p.species AS pet_species
           FROM adoptions a JOIN pets p ON p.id = a.pet_id WHERE a.id = $1`,
          [req.params.id]
        ),
        db.query(
          `SELECT h.*, u.name AS changed_by_name
           FROM adoption_status_history h
           LEFT JOIN users u ON u.id = h.changed_by
           WHERE h.adoption_id = $1 ORDER BY h.created_at DESC`,
          [req.params.id]
        ),
        db.query(
          'SELECT * FROM adoption_checklists WHERE adoption_id = $1 ORDER BY item_key',
          [req.params.id]
        ),
      ]);

      if (adoptionResult.rows.length === 0) {
        return res.status(404).render('404', { title: 'Adoção não encontrada' });
      }

      return res.render('admin/adoption-detail', {
        title: 'Acompanhamento da adoção — Adota Pet',
        adoption: adoptionResult.rows[0],
        history: historyResult.rows,
        checklist: checklistResult.rows,
      });
    } catch (err) {
      console.error('Erro ao carregar detalhes da adoção:', err);
      req.session.error = 'Não foi possível carregar o acompanhamento da adoção.';
      return res.redirect('/admin/adoptions');
    }
  },

  async updateChecklist(req, res) {
    const validItems = ['documents', 'interview', 'home_visit', 'contract', 'handover_ready'];
    const { item_key, note } = req.body;
    const completed = req.body.completed === 'on';

    if (!validItems.includes(item_key)) {
      req.session.error = 'Item de checklist inválido.';
      return res.redirect(`/admin/adoptions/${req.params.id}`);
    }

    try {
      await db.query(
        `INSERT INTO adoption_checklists
           (adoption_id, item_key, completed, note, completed_by, completed_at)
         VALUES ($1, $2, $3, $4, $5, CASE WHEN $3 THEN NOW() ELSE NULL END)
         ON CONFLICT (adoption_id, item_key) DO UPDATE SET
           completed = EXCLUDED.completed, note = EXCLUDED.note,
           completed_by = EXCLUDED.completed_by, completed_at = EXCLUDED.completed_at`,
        [req.params.id, item_key, completed, note ? note.trim() : null, req.session.user.id]
      );
      await db.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, 'adoption_checklist_updated', 'adoption', $2, $3::jsonb)`,
        [req.session.user.id, req.params.id, JSON.stringify({ item: item_key, completed })]
      );
      req.session.success = 'Checklist atualizado.';
    } catch (err) {
      console.error('Erro ao atualizar checklist:', err);
      req.session.error = 'Não foi possível atualizar o checklist.';
    }
    return res.redirect(`/admin/adoptions/${req.params.id}`);
  },

  async confirmDelivery(req, res) {
    const { signed_by, document_reference, notes } = req.body;
    if (!signed_by || !signed_by.trim()) {
      req.session.error = 'Informe quem confirmou a entrega.';
      return res.redirect(`/admin/adoptions/${req.params.id}`);
    }

    try {
      const result = await db.transaction(async (client) => {
        const adoptionResult = await client.query(
          `SELECT a.id, a.pet_id, a.status, p.status AS pet_status
           FROM adoptions a JOIN pets p ON p.id = a.pet_id
           WHERE a.id = $1 FOR UPDATE OF a, p`,
          [req.params.id]
        );
        if (adoptionResult.rows.length === 0) return { notFound: true };
        const adoption = adoptionResult.rows[0];
        if (adoption.status !== 'approved' || adoption.pet_status !== 'reserved') return { conflict: true };

        await client.query(
          `INSERT INTO adoption_deliveries (adoption_id, signed_by, document_reference, notes, confirmed_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [adoption.id, signed_by.trim(), document_reference?.trim() || null, notes?.trim() || null, req.session.user.id]
        );
        await client.query('UPDATE adoptions SET status = \'completed\' WHERE id = $1', [adoption.id]);
        await client.query("UPDATE pets SET status = 'adopted' WHERE id = $1", [adoption.pet_id]);
        await client.query(
          `INSERT INTO adoption_status_history (adoption_id, old_status, new_status, changed_by, note)
           VALUES ($1, 'approved', 'completed', $2, $3)`,
          [adoption.id, req.session.user.id, 'Entrega confirmada']
        );
        await client.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, 'adoption_delivery_confirmed', 'adoption', $2, $3::jsonb)`,
          [req.session.user.id, adoption.id, JSON.stringify({ signedBy: signed_by.trim() })]
        );
        return { updated: true };
      });

      if (result.notFound) req.session.error = 'Solicitação não encontrada.';
      else if (result.conflict) req.session.error = 'A adoção precisa estar aprovada e o pet reservado.';
      else req.session.success = 'Entrega do pet confirmada com sucesso.';
    } catch (err) {
      console.error('Erro ao confirmar entrega:', err);
      req.session.error = 'Não foi possível confirmar a entrega.';
    }
    return res.redirect(`/admin/adoptions/${req.params.id}`);
  },
};

module.exports = adoptionsController;
