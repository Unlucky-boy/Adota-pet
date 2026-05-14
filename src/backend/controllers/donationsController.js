const crypto = require('crypto');
const db = require('../config/db');
const settingsController = require('./settingsController');

const donationsController = {
  // GET /donate — Página de doação
  async donatePage(req, res) {
    try {
      const settings = await settingsController.getAll();
      
      let initialFormData = req.session.formData || {};
      if (!req.session.formData && req.session.adopter) {
        initialFormData = {
          donor_name: req.session.adopter.name,
          donor_email: req.session.adopter.email
        };
      }

      res.render('donations/form', {
        title: 'Doe Agora — Adota Pet',
        formData: initialFormData,
        pixKey: settings.pix_key || '',
        projectEmail: settings.project_email || '',
      });
      delete req.session.formData;
    } catch (err) {
      console.error('Erro ao carregar página de doação:', err);
      res.render('donations/form', {
        title: 'Doe Agora — Adota Pet',
        formData: req.session.formData || {},
        pixKey: '',
        projectEmail: '',
      });
      delete req.session.formData;
    }
  },

  // POST /donate — Processar doação
  async donate(req, res) {
    const { amount, payment_method, donor_name, donor_email } = req.body;

    // Preservar dados do form
    req.session.formData = { amount, payment_method, donor_name, donor_email };

    // Validar valor
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      req.session.error = 'Informe um valor válido para a doação.';
      return res.redirect('/donate');
    }

    if (parsedAmount > 100000) {
      req.session.error = 'O valor máximo por doação é R$ 100.000,00.';
      return res.redirect('/donate');
    }

    // Validar método de pagamento
    const validMethods = ['pix'];
    if (!payment_method || !validMethods.includes(payment_method)) {
      req.session.error = 'Selecione um método de pagamento válido.';
      return res.redirect('/donate');
    }

    // Validar e-mail se fornecido
    if (donor_email && donor_email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(donor_email)) {
        req.session.error = 'E-mail do doador inválido.';
        return res.redirect('/donate');
      }
    }

    try {
      // Gerar código do comprovante
      const receiptCode = crypto.randomUUID().split('-')[0].toUpperCase()
        + '-' + Date.now().toString(36).toUpperCase();

      // Capturar imagem do comprovante se enviado (via multer)
      const receiptImage = req.file ? `/uploads/${req.file.filename}` : null;

      // Determinar status baseado no método
      // PIX com comprovante = pending_review, sem = pending_payment
      // Card/Boleto = completed (simulado)
      let status = 'completed';
      if (payment_method === 'pix') {
        status = receiptImage ? 'pending_review' : 'pending_payment';
      }

      // Inserir doação
      await db.query(
        `INSERT INTO donations (amount, payment_method, donor_name, donor_email, status, receipt_code, receipt_image)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          parsedAmount.toFixed(2),
          payment_method,
          donor_name ? donor_name.trim() : null,
          donor_email ? donor_email.toLowerCase().trim() : null,
          status,
          receiptCode,
          receiptImage,
        ]
      );

      // Limpar dados do form
      delete req.session.formData;

      const successMsg = payment_method === 'pix' && !receiptImage
        ? 'Doação registrada! Faça a transferência PIX e envie o comprovante.'
        : payment_method === 'pix' && receiptImage
          ? 'Doação registrada com comprovante! Aguarde a confirmação da ONG.'
          : 'Doação realizada com sucesso! Obrigado pela contribuição!';

      req.session.success = successMsg;
      return res.redirect(`/donate/receipt/${receiptCode}`);
    } catch (err) {
      console.error('Erro ao processar doação:', err);
      req.session.error = 'Erro ao processar doação. Tente novamente.';
      return res.redirect('/donate');
    }
  },

  // POST /donate/receipt/:code/upload — Upload de comprovante PIX posterior
  async uploadReceipt(req, res) {
    const { code } = req.params;

    if (!req.file) {
      req.session.error = 'Selecione uma imagem do comprovante.';
      return res.redirect(`/donate/receipt/${code}`);
    }

    try {
      const receiptImage = `/uploads/${req.file.filename}`;
      const result = await db.query(
        `UPDATE donations SET receipt_image = $1, status = 'pending_review'
         WHERE receipt_code = $2 AND payment_method = 'pix'
         RETURNING id`,
        [receiptImage, code]
      );

      if (result.rows.length === 0) {
        req.session.error = 'Doação não encontrada.';
        return res.redirect('/donate');
      }

      req.session.success = 'Comprovante enviado com sucesso! Aguarde a confirmação da ONG.';
      return res.redirect(`/donate/receipt/${code}`);
    } catch (err) {
      console.error('Erro ao enviar comprovante:', err);
      req.session.error = 'Erro ao enviar comprovante.';
      return res.redirect(`/donate/receipt/${code}`);
    }
  },

  // GET /donate/receipt/:code — Comprovante
  async receiptPage(req, res) {
    try {
      const { code } = req.params;
      const result = await db.query(
        'SELECT * FROM donations WHERE receipt_code = $1',
        [code]
      );

      if (result.rows.length === 0) {
        req.session.error = 'Comprovante não encontrado.';
        return res.redirect('/donate');
      }

      const donation = result.rows[0];
      const settings = await settingsController.getAll();

      res.render('donations/receipt', {
        title: 'Comprovante de Doação — Adota Pet',
        donation,
        pixKey: settings.pix_key || '',
        projectEmail: settings.project_email || '',
      });
    } catch (err) {
      console.error('Erro ao buscar comprovante:', err);
      req.session.error = 'Erro ao carregar comprovante.';
      return res.redirect('/donate');
    }
  },

  // GET /admin/donations — Painel admin de doações
  async adminList(req, res) {
    try {
      const result = await db.query(
        'SELECT * FROM donations ORDER BY created_at DESC'
      );
      
      const totalBalanceResult = await db.query(
        "SELECT SUM(amount) as total FROM donations WHERE status = 'completed'"
      );
      const totalBalance = totalBalanceResult.rows[0].total || 0;

      res.render('admin/donations', {
        title: 'Gerenciar Doações — Adota Pet',
        donations: result.rows,
        totalBalance: parseFloat(totalBalance),
      });
    } catch (err) {
      console.error('Erro ao listar doações:', err);
      res.render('admin/donations', {
        title: 'Gerenciar Doações',
        donations: [],
        totalBalance: 0,
      });
    }
  },

  // POST /admin/donations/:id/status — Confirmar/rejeitar doação PIX
  async updateStatus(req, res) {
    const { status } = req.body;
    const validStatuses = ['completed', 'rejected'];

    if (!validStatuses.includes(status)) {
      req.session.error = 'Status inválido.';
      return res.redirect('/admin/donations');
    }

    try {
      await db.query(
        'UPDATE donations SET status = $1 WHERE id = $2',
        [status, req.params.id]
      );

      const label = status === 'completed' ? 'confirmada' : 'rejeitada';
      req.session.success = `Doação ${label} com sucesso!`;
      return res.redirect('/admin/donations');
    } catch (err) {
      console.error('Erro ao atualizar doação:', err);
      req.session.error = 'Erro ao atualizar doação.';
      return res.redirect('/admin/donations');
    }
  },
};

module.exports = donationsController;
