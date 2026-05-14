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
      // Tentar login como Admin (users)
      const adminResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);

      if (adminResult.rows.length > 0) {
        const user = adminResult.rows[0];
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
      }

      // Tentar login como Adotante (adopters)
      const adopterResult = await db.query('SELECT * FROM adopters WHERE email = $1', [email]);
      
      if (adopterResult.rows.length > 0) {
        const adopter = adopterResult.rows[0];
        
        // Verifica se a senha está definida (adotantes antigos podem não ter)
        if (!adopter.password_hash) {
            req.session.error = 'Sua conta não possui senha. Por favor, entre em contato com a ONG.';
            return res.redirect('/login');
        }

        const validPassword = await bcrypt.compare(password, adopter.password_hash);

        if (!validPassword) {
          req.session.error = 'E-mail ou senha inválidos.';
          return res.redirect('/login');
        }

        req.session.adopter = {
          id: adopter.id,
          name: adopter.name,
          email: adopter.email,
        };

        req.session.success = `Bem-vindo(a), ${adopter.name}!`;
        return res.redirect('/dashboard');
      }

      // Se não encontrou em nenhum dos dois
      req.session.error = 'E-mail ou senha inválidos.';
      return res.redirect('/login');

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
