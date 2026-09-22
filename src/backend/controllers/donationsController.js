const crypto = require('crypto');
const db = require('../config/db');
const { isValidEmail, isValidId, parseStrictAmount } = require('../utils/validation');
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
    const parsedAmount = parseStrictAmount(amount);
    if (parsedAmount === null) {
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
      if (!isValidEmail(donor_email)) {
        req.session.error = 'E-mail do doador inválido.';
        return res.redirect('/donate');
      }
    }

    try {
      // Gerar código do comprovante
      const receiptCode = crypto.randomUUID().split('-')[0].toUpperCase()
        + '-' + Date.now().toString(36).toUpperCase();

      // Capturar imagem do comprovante se enviado (via multer — memoryStorage)
      const receiptImageBuffer = req.file ? req.file.buffer : null;
      const receiptImageMime = req.file ? req.file.mimetype : null;

      // Determinar status baseado no método
      // PIX com comprovante = pending_review, sem = pending_payment
      // Card/Boleto = completed (simulado)
      let status = 'completed';
      if (payment_method === 'pix') {
        status = receiptImageBuffer ? 'pending_review' : 'pending_payment';
      }

      // Inserir doação
      await db.query(
        `INSERT INTO donations (amount, payment_method, donor_name, donor_email, status, receipt_code, receipt_image, receipt_image_mime_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          parsedAmount.toFixed(2),
          payment_method,
          donor_name ? donor_name.trim() : null,
          donor_email ? donor_email.toLowerCase().trim() : null,
          status,
          receiptCode,
          receiptImageBuffer,
          receiptImageMime,
        ]
      );

      // Limpar dados do form
      delete req.session.formData;
      req.session.donationReceiptCodes = req.session.donationReceiptCodes || [];
      req.session.donationReceiptCodes.push(receiptCode);

      const successMsg = payment_method === 'pix' && !receiptImageBuffer
        ? 'Doação registrada! Faça a transferência PIX e envie o comprovante.'
        : payment_method === 'pix' && receiptImageBuffer
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
      const receiptImageBuffer = req.file.buffer;
      const receiptImageMime = req.file.mimetype;
      const result = await db.query(
        `UPDATE donations SET receipt_image = $1, receipt_image_mime_type = $2, status = 'pending_review'
         WHERE receipt_code = $3 AND payment_method = 'pix'
         RETURNING id`,
        [receiptImageBuffer, receiptImageMime, code]
      );

      if (result.rows.length === 0) {
        req.session.error = 'Doação não encontrada.';
        return res.redirect('/donate');
      }

      req.session.success = 'Comprovante enviado com sucesso! Aguarde a confirmação da ONG.';
      req.session.donationReceiptCodes = req.session.donationReceiptCodes || [];
      if (!req.session.donationReceiptCodes.includes(code)) req.session.donationReceiptCodes.push(code);
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
      const isAdmin = Boolean(req.session.user);
      const isOwner = Boolean(req.session.adopter && donation.donor_email &&
        req.session.adopter.email.toLowerCase() === donation.donor_email.toLowerCase());
      const ownsReceipt = Boolean(req.session.donationReceiptCodes &&
        req.session.donationReceiptCodes.includes(code));
      if (!isAdmin && !isOwner && !ownsReceipt) {
        req.session.error = 'Você não tem acesso a este comprovante.';
        return res.redirect('/donate');
      }

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

  // GET /donations/:id/receipt-image — Servir imagem do comprovante armazenada no banco
  async serveReceiptImage(req, res) {
    try {
      const result = await db.query(
        'SELECT id, receipt_code, donor_email, receipt_image, receipt_image_mime_type FROM donations WHERE id = $1',
        [req.params.id]
      );
      if (result.rows.length === 0 || !result.rows[0].receipt_image) {
        return res.status(404).send('Comprovante não encontrado.');
      }
      const donation = result.rows[0];
      const isAdmin = Boolean(req.session.user);
      const isOwner = Boolean(req.session.adopter && donation.donor_email &&
        req.session.adopter.email.toLowerCase() === donation.donor_email.toLowerCase());
      const ownsAnonymousReceipt = Boolean(req.session.donationReceiptCodes &&
        req.session.donationReceiptCodes.includes(donation.receipt_code));
      if (!isAdmin && !isOwner && !ownsAnonymousReceipt) {
        return res.status(403).send('Acesso não autorizado.');
      }
      res.set('Content-Type', donation.receipt_image_mime_type || 'image/png');
      res.send(donation.receipt_image);
    } catch (err) {
      console.error('Erro ao servir comprovante:', err);
      res.status(500).send('Erro interno');
    }
  },

  // POST /admin/donations/:id/status — Confirmar/rejeitar doação PIX
  async updateStatus(req, res) {
    const { status } = req.body;
    const validStatuses = ['completed', 'rejected'];

    if (!isValidId(req.params.id) || !validStatuses.includes(status)) {
      req.session.error = 'Status inválido.';
      return res.redirect('/admin/donations');
    }

    try {
      await db.query(
        'UPDATE donations SET status = $1 WHERE id = $2',
        [status, req.params.id]
      );
      await db.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, 'donation_status_changed', 'donation', $2, $3::jsonb)`,
        [req.session.user.id, req.params.id, JSON.stringify({ status })]
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
