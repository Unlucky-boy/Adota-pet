const bcrypt = require('bcrypt');
const db = require('../config/db');

const authController = {
  // GET /login
  loginPage(req, res) {
    if (req.session.user) {
      return res.redirect('/admin/pets');
    }
    res.render('auth/login', { title: 'Login — Adota Pet' });
  },

  // POST /login
  async login(req, res) {
    const { email, password } = req.body;

    try {
      const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);

      if (result.rows.length === 0) {
        req.session.error = 'E-mail ou senha inválidos.';
        return res.redirect('/login');
      }

      const user = result.rows[0];
      const validPassword = await bcrypt.compare(password, user.password_hash);

      if (!validPassword) {
        req.session.error = 'E-mail ou senha inválidos.';
        return res.redirect('/login');
      }

      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
      };

      req.session.success = `Bem-vindo(a), ${user.name}!`;
      return res.redirect('/admin/pets');
    } catch (err) {
      console.error('Erro no login:', err);
      req.session.error = 'Erro interno. Tente novamente.';
      return res.redirect('/login');
    }
  },

  // GET /logout
  logout(req, res) {
    req.session.destroy(() => {
      res.redirect('/');
    });
  },
};

module.exports = authController;
