const db = require('../config/db');

const dashboardController = {
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
