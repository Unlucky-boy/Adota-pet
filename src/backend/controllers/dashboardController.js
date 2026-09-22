const db = require('../config/db');

function csvEscape(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function sendCsv(res, filename, headers, rows) {
  const content = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(';'))
    .join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(`\uFEFF${content}`);
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function getPeriod(req) {
  const startDate = req.query?.start_date || '';
  const endDate = req.query?.end_date || '';
  const invalid = (startDate && !isValidDate(startDate))
    || (endDate && !isValidDate(endDate))
    || (startDate && endDate && startDate > endDate);

  return {
    startDate: invalid ? '' : startDate,
    endDate: invalid ? '' : endDate,
    invalid,
  };
}

function periodParams(period) {
  return [period.startDate || null, period.endDate || null];
}

const dashboardController = {
  async adminAnalytics(req, res) {
    const period = getPeriod(req);
    try {
      const [petsResult, adoptionsResult, donationsResult, volunteersResult, visitsResult, speciesResult, recentAdoptionsResult, monthlyDonationsResult] = await Promise.all([
        db.query(`SELECT COUNT(*)::int AS total,
                         COUNT(*) FILTER (WHERE status = 'available')::int AS available,
                         COUNT(*) FILTER (WHERE status = 'reserved')::int AS reserved,
                         COUNT(*) FILTER (WHERE status = 'adopted')::int AS adopted
                  FROM pets
                  WHERE ($1::date IS NULL OR created_at >= $1::date)
                    AND ($2::date IS NULL OR created_at < $2::date + INTERVAL '1 day')`, periodParams(period)),
        db.query(`SELECT COUNT(*)::int AS total,
                         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
                         COUNT(*) FILTER (WHERE status IN ('approved', 'completed'))::int AS approved,
                         COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected
                  FROM adoptions
                  WHERE ($1::date IS NULL OR created_at >= $1::date)
                    AND ($2::date IS NULL OR created_at < $2::date + INTERVAL '1 day')`, periodParams(period)),
        db.query(`SELECT COUNT(*)::int AS total,
                         COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0)::numeric AS confirmed,
                         COUNT(*) FILTER (WHERE status IN ('pending_payment', 'pending_review'))::int AS pending
                  FROM donations
                  WHERE ($1::date IS NULL OR created_at >= $1::date)
                    AND ($2::date IS NULL OR created_at < $2::date + INTERVAL '1 day')`, periodParams(period)),
        db.query(`SELECT COUNT(*)::int AS total,
                         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
                         COUNT(*) FILTER (WHERE status = 'approved')::int AS approved
                  FROM volunteers
                  WHERE ($1::date IS NULL OR created_at >= $1::date)
                    AND ($2::date IS NULL OR created_at < $2::date + INTERVAL '1 day')`, periodParams(period)),
        db.query(`SELECT COUNT(*)::int AS total,
                         COUNT(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
                         COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
                  FROM visits
                  WHERE ($1::date IS NULL OR visit_date >= $1::date)
                    AND ($2::date IS NULL OR visit_date < $2::date + INTERVAL '1 day')`, periodParams(period)),
        db.query(`SELECT species, COUNT(*)::int AS count
                  FROM pets
                  WHERE ($1::date IS NULL OR created_at >= $1::date)
                    AND ($2::date IS NULL OR created_at < $2::date + INTERVAL '1 day')
                  GROUP BY species
                  ORDER BY count DESC`, periodParams(period)),
        db.query(`SELECT a.id, a.adopter_name, a.status, a.created_at, p.name AS pet_name
                  FROM adoptions a
                  JOIN pets p ON p.id = a.pet_id
                  WHERE ($1::date IS NULL OR a.created_at >= $1::date)
                    AND ($2::date IS NULL OR a.created_at < $2::date + INTERVAL '1 day')
                  ORDER BY a.created_at DESC
                  LIMIT 6`, periodParams(period)),
                db.query(`SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
                     COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0)::numeric AS total,
                     COUNT(*) FILTER (WHERE status = 'completed')::int AS count
                    FROM donations
                    WHERE created_at >= CASE WHEN $1::date IS NULL
                                             THEN DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
                                             ELSE $1::date END
                      AND ($2::date IS NULL OR created_at < $2::date + INTERVAL '1 day')
                    GROUP BY DATE_TRUNC('month', created_at)
                    ORDER BY month`, periodParams(period)),
      ]);

      res.render('admin/dashboard', {
        title: 'Dashboard Analítico — Adota Pet',
        petStats: petsResult.rows[0],
        adoptionStats: adoptionsResult.rows[0],
        donationStats: donationsResult.rows[0],
        volunteerStats: volunteersResult.rows[0],
        visitStats: visitsResult.rows[0],
        speciesStats: speciesResult.rows,
        recentAdoptions: recentAdoptionsResult.rows,
        monthlyDonations: monthlyDonationsResult.rows,
        period,
      });
    } catch (err) {
      console.error('Erro ao carregar dashboard analítico:', err);
      req.session.error = 'Não foi possível carregar o dashboard analítico.';
      res.redirect('/admin/pets');
    }
  },

  async index(req, res) {
    if (!req.session.adopter) {
      req.session.error = 'Por favor, faça login para acessar o painel.';
      return res.redirect('/login');
    }

    try {
      // Carregar dados do usuário
      const adopterId = req.session.adopter.id;
      const adopterEmail = req.session.adopter.email;
      
      const adopterResult = await db.query('SELECT * FROM adopters WHERE id = $1', [adopterId]);
      const adopter = adopterResult.rows[0];
      if (!adopter) {
        req.session.error = 'Conta de adotante não encontrada.';
        return req.session.destroy(() => res.redirect('/login'));
      }

      // Carregar histórico de doações do usuário
      const donationsResult = await db.query(
        'SELECT * FROM donations WHERE donor_email = $1 ORDER BY created_at DESC',
        [adopterEmail]
      );
      const userDonations = donationsResult.rows;

      // Calcular valor total doado
      const totalDonatedResult = await db.query(
        "SELECT SUM(amount) as total FROM donations WHERE donor_email = $1 AND status = 'completed'",
        [adopterEmail]
      );
      const totalDonated = totalDonatedResult.rows[0]?.total || 0;

      // Carregar solicitações de voluntariado do usuário
      const volunteerResult = await db.query(
        'SELECT * FROM volunteers WHERE email = $1 ORDER BY created_at DESC',
        [adopterEmail]
      );
      const userVolunteers = volunteerResult.rows;

      // Carregar solicitações de adoção e visitas agendadas
      const adoptionsResult = await db.query(
        `SELECT a.*, p.name as pet_name, p.image_url as pet_image_url, 
                v.visit_date, v.visit_time, v.status as visit_status 
         FROM adoptions a
         LEFT JOIN pets p ON a.pet_id = p.id
         LEFT JOIN LATERAL (
           SELECT visit_date, visit_time, status
           FROM visits
           WHERE adoption_id = a.id
           ORDER BY visit_date ASC, visit_time ASC
           LIMIT 1
         ) v ON TRUE
         WHERE a.adopter_email = $1
         ORDER BY a.created_at DESC`,
        [adopterEmail]
      );
      const userAdoptions = adoptionsResult.rows;

      res.render('dashboard/index', {
        title: 'Meu Painel — Adota Pet',
        adopter,
        userDonations,
        totalDonated: parseFloat(totalDonated),
        userVolunteers,
        userAdoptions
      });
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
      req.session.error = 'Erro interno.';
      res.redirect('/');
    }
  },

  async donationsReport(req, res) {
    const period = getPeriod(req);
    try {
      const result = await db.query(
        `SELECT receipt_code, created_at, donor_name, donor_email,
                amount, payment_method, status
         FROM donations
         WHERE ($1::date IS NULL OR created_at >= $1::date)
           AND ($2::date IS NULL OR created_at < $2::date + INTERVAL '1 day')
         ORDER BY created_at DESC`
        , periodParams(period)
      );

      return sendCsv(
        res,
        'relatorio-doacoes.csv',
        ['Código', 'Data', 'Doador', 'E-mail', 'Valor', 'Método', 'Status'],
        result.rows.map((donation) => [
          donation.receipt_code,
          donation.created_at,
          donation.donor_name,
          donation.donor_email,
          donation.amount,
          donation.payment_method,
          donation.status,
        ])
      );
    } catch (err) {
      console.error('Erro ao exportar relatório de doações:', err);
      req.session.error = 'Não foi possível gerar o relatório de doações.';
      return res.redirect('/admin/dashboard');
    }
  },

  async adoptionsReport(req, res) {
    const period = getPeriod(req);
    try {
      const result = await db.query(
        `SELECT a.id, a.created_at, p.name AS pet_name,
                a.adopter_name, a.adopter_email, a.status
         FROM adoptions a
         JOIN pets p ON p.id = a.pet_id
         WHERE ($1::date IS NULL OR a.created_at >= $1::date)
           AND ($2::date IS NULL OR a.created_at < $2::date + INTERVAL '1 day')
         ORDER BY a.created_at DESC`
        , periodParams(period)
      );

      return sendCsv(
        res,
        'relatorio-adocoes.csv',
        ['ID', 'Data', 'Pet', 'Solicitante', 'E-mail', 'Status'],
        result.rows.map((adoption) => [
          adoption.id,
          adoption.created_at,
          adoption.pet_name,
          adoption.adopter_name,
          adoption.adopter_email,
          adoption.status,
        ])
      );
    } catch (err) {
      console.error('Erro ao exportar relatório de adoções:', err);
      req.session.error = 'Não foi possível gerar o relatório de adoções.';
      return res.redirect('/admin/dashboard');
    }
  },

  async financialReport(req, res) {
    const period = getPeriod(req);
    try {
      const result = await db.query(
        `WITH months AS (
          SELECT generate_series(
            DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months',
            DATE_TRUNC('month', CURRENT_DATE),
            INTERVAL '1 month'
          ) AS month_start
        )
        SELECT TO_CHAR(m.month_start, 'YYYY-MM') AS month,
               COALESCE((SELECT SUM(d.amount) FROM donations d
                         WHERE d.status = 'completed'
                           AND ($1::date IS NULL OR d.created_at >= $1::date)
                           AND ($2::date IS NULL OR d.created_at < $2::date + INTERVAL '1 day')
                           AND DATE_TRUNC('month', d.created_at) = m.month_start), 0) AS donations,
               COALESCE((SELECT SUM(e.amount) FROM expenses e
                         WHERE ($1::date IS NULL OR e.expense_date >= $1::date)
                           AND ($2::date IS NULL OR e.expense_date < $2::date + INTERVAL '1 day')
                           AND DATE_TRUNC('month', e.expense_date) = m.month_start), 0) AS expenses
        FROM months m ORDER BY m.month_start`, periodParams(period)
      );

      return sendCsv(
        res,
        'relatorio-financeiro-mensal.csv',
        ['Mês', 'Doações confirmadas', 'Despesas', 'Saldo líquido'],
        result.rows.map((row) => [
          row.month,
          row.donations,
          row.expenses,
          Number(row.donations) - Number(row.expenses),
        ])
      );
    } catch (err) {
      console.error('Erro ao exportar relatório financeiro:', err);
      req.session.error = 'Não foi possível gerar o relatório financeiro.';
      return res.redirect('/admin/dashboard');
    }
  }
};

module.exports = dashboardController;
