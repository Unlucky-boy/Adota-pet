const db = require('../config/db');

const dashboardController = {
  async adminAnalytics(req, res) {
    try {
      const [petsResult, adoptionsResult, donationsResult, volunteersResult, visitsResult, speciesResult, recentAdoptionsResult] = await Promise.all([
        db.query(`SELECT COUNT(*)::int AS total,
                         COUNT(*) FILTER (WHERE status = 'available')::int AS available,
                         COUNT(*) FILTER (WHERE status = 'reserved')::int AS reserved,
                         COUNT(*) FILTER (WHERE status = 'adopted')::int AS adopted
                  FROM pets`),
        db.query(`SELECT COUNT(*)::int AS total,
                         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
                         COUNT(*) FILTER (WHERE status IN ('approved', 'completed'))::int AS approved,
                         COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected
                  FROM adoptions`),
        db.query(`SELECT COUNT(*)::int AS total,
                         COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0)::numeric AS confirmed,
                         COUNT(*) FILTER (WHERE status IN ('pending_payment', 'pending_review'))::int AS pending
                  FROM donations`),
        db.query(`SELECT COUNT(*)::int AS total,
                         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
                         COUNT(*) FILTER (WHERE status = 'approved')::int AS approved
                  FROM volunteers`),
        db.query(`SELECT COUNT(*)::int AS total,
                         COUNT(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
                         COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
                  FROM visits`),
        db.query(`SELECT species, COUNT(*)::int AS count
                  FROM pets
                  GROUP BY species
                  ORDER BY count DESC`),
        db.query(`SELECT a.id, a.adopter_name, a.status, a.created_at, p.name AS pet_name
                  FROM adoptions a
                  JOIN pets p ON p.id = a.pet_id
                  ORDER BY a.created_at DESC
                  LIMIT 6`),
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
      const totalDonated = totalDonatedResult.rows[0].total || 0;

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
         LEFT JOIN visits v ON v.adoption_id = a.id
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
  }
};

module.exports = dashboardController;
