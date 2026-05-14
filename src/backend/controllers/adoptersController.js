const db = require('../config/db');
const { validateCpf, formatCpf } = require('../utils/cpf');

const adoptersController = {
  // GET /register — Página de cadastro
  registerPage(req, res) {
    res.render('register/form', {
      title: 'Cadastro — Adota Pet',
      formData: req.session.formData || {},
    });
    delete req.session.formData;
  },

  // POST /register — Processar cadastro
  async register(req, res) {
    const { name, cpf, phone, email, address, password, password_confirm } = req.body;
    const bcrypt = require('bcrypt');

    // Preservar dados do form para repopular em caso de erro
    req.session.formData = { name, cpf, phone, email, address };

    // Validações
    if (!name || !cpf || !phone || !email || !address || !password || !password_confirm) {
      req.session.error = 'Todos os campos são obrigatórios.';
      return res.redirect('/register');
    }

    if (password !== password_confirm) {
      req.session.error = 'As senhas não coincidem.';
      return res.redirect('/register');
    }

    if (password.length < 6) {
      req.session.error = 'A senha deve ter no mínimo 6 caracteres.';
      return res.redirect('/register');
    }

    // Validar e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      req.session.error = 'E-mail inválido. Verifique e tente novamente.';
      return res.redirect('/register');
    }

    // Validar CPF (formato + dígitos verificadores)
    if (!validateCpf(cpf)) {
      req.session.error = 'CPF inválido. Verifique e tente novamente.';
      return res.redirect('/register');
    }

    const cpfFormatted = formatCpf(cpf);

    try {
      // Verificar CPF duplicado
      const cpfCheck = await db.query(
        'SELECT id FROM adopters WHERE cpf = $1',
        [cpfFormatted]
      );
      if (cpfCheck.rows.length > 0) {
        req.session.error = 'Este CPF já está cadastrado no sistema.';
        return res.redirect('/register');
      }

      // Verificar e-mail duplicado
      const emailCheck = await db.query(
        'SELECT id FROM adopters WHERE email = $1',
        [email.toLowerCase().trim()]
      );
      if (emailCheck.rows.length > 0) {
        req.session.error = 'Este e-mail já está cadastrado no sistema.';
        return res.redirect('/register');
      }

      const passwordHash = await bcrypt.hash(password, 10);

      // Inserir adotante
      await db.query(
        `INSERT INTO adopters (name, cpf, phone, email, address, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [name.trim(), cpfFormatted, phone.trim(), email.toLowerCase().trim(), address.trim(), passwordHash]
      );

      // Limpar dados do form e redirecionar
      delete req.session.formData;
      req.session.success = 'Cadastro realizado com sucesso! Bem-vindo(a) ao Adota Pet!';
      return res.redirect('/register/success');
    } catch (err) {
      console.error('Erro ao cadastrar adotante:', err);
      req.session.error = 'Erro interno. Tente novamente mais tarde.';
      return res.redirect('/register');
    }
  },

  // GET /register/success — Página de confirmação
  successPage(req, res) {
    res.render('register/success', {
      title: 'Cadastro Realizado — Adota Pet',
    });
  },
};

module.exports = adoptersController;
