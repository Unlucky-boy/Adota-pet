const assert = require('node:assert/strict');
const { describe, test, beforeEach, afterEach } = require('node:test');

const { createRequest, createResponse, stubDb } = require('../helpers/controller-harness');
const donationsController = require('../../src/backend/controllers/donationsController');

/** Corpo mínimo aceito por donate — os testes sobrescrevem o que interessa. */
function donationBody(overrides = {}) {
  return { amount: '50', payment_method: 'pix', ...overrides };
}

/** Linha de doação devolvida pelas consultas de comprovante. */
function donationRow(overrides = {}) {
  return {
    id: 3,
    receipt_code: 'ABCD-123',
    donor_email: 'joao@example.com',
    amount: '50.00',
    status: 'pending_review',
    receipt_image: Buffer.from('receipt'),
    receipt_image_mime_type: 'image/png',
    ...overrides,
  };
}

describe('donations controller', () => {
  let stub;

  beforeEach(() => {
    stub = stubDb();
  });

  afterEach(() => {
    stub.restore();
  });

  describe('donate', () => {
    test('rejects a missing donation amount', async () => {
      const req = createRequest({ body: donationBody({ amount: undefined }), session: {} });
      const res = createResponse();

      await donationsController.donate(req, res);

      assert.equal(stub.calls.length, 0);
      assert.equal(req.session.error, 'Informe um valor válido para a doação.');
      assert.equal(res.redirectPath, '/donate');
    });

    test('rejects a non numeric donation amount', async () => {
      const req = createRequest({ body: donationBody({ amount: 'abc' }), session: {} });
      const res = createResponse();

      await donationsController.donate(req, res);

      assert.equal(stub.calls.length, 0);
      assert.equal(req.session.error, 'Informe um valor válido para a doação.');
    });

    test('rejects invalid donation amounts before touching the database', async () => {
      for (const amount of ['0', '-5']) {
        stub.restore();
        stub = stubDb();
        const req = createRequest({ body: donationBody({ amount }), session: {} });
        const res = createResponse();

        await donationsController.donate(req, res);

        assert.equal(stub.calls.length, 0);
        assert.equal(req.session.error, 'Informe um valor válido para a doação.');
        assert.equal(res.redirectPath, '/donate');
        assert.deepEqual(req.session.formData, {
          amount,
          payment_method: 'pix',
          donor_name: undefined,
          donor_email: undefined,
        });
      }
    });

    test('rejects a donation above the maximum allowed amount', async () => {
      const req = createRequest({ body: donationBody({ amount: '100000.01' }), session: {} });
      const res = createResponse();

      await donationsController.donate(req, res);

      assert.equal(stub.calls.length, 0);
      assert.equal(req.session.error, 'O valor máximo por doação é R$ 100.000,00.');
      assert.equal(res.redirectPath, '/donate');
    });

    test('accepts a donation at exactly the maximum amount', async () => {
      stub.queueResults({ rows: [] });
      const req = createRequest({ body: donationBody({ amount: '100000' }), session: {} });
      const res = createResponse();

      await donationsController.donate(req, res);

      const [insert] = stub.matching('INSERT INTO donations');
      assert.equal(insert.params[0], '100000.00');
    });

    test('rejects a missing payment method', async () => {
      const req = createRequest({ body: donationBody({ payment_method: undefined }), session: {} });
      const res = createResponse();

      await donationsController.donate(req, res);

      assert.equal(stub.calls.length, 0);
      assert.equal(req.session.error, 'Selecione um método de pagamento válido.');
    });

    test('rejects an unsupported payment method', async () => {
      const req = createRequest({ body: donationBody({ payment_method: 'card' }), session: {} });
      const res = createResponse();

      await donationsController.donate(req, res);

      assert.equal(stub.calls.length, 0);
      assert.equal(req.session.error, 'Selecione um método de pagamento válido.');
    });

    test('rejects an invalid donor email before inserting a donation', async () => {
      const req = createRequest({ body: donationBody({ donor_email: 'invalid-email' }), session: {} });
      const res = createResponse();

      await donationsController.donate(req, res);

      assert.equal(stub.calls.length, 0);
      assert.equal(req.session.error, 'E-mail do doador inválido.');
      assert.equal(res.redirectPath, '/donate');
    });

    test('accepts a donation with a blank donor email', async () => {
      stub.queueResults({ rows: [] });
      const req = createRequest({ body: donationBody({ donor_email: '   ' }), session: {} });
      const res = createResponse();

      await donationsController.donate(req, res);

      const [insert] = stub.matching('INSERT INTO donations');
      // Espaços em branco passam pela validação e são gravados como string vazia.
      assert.equal(insert.params[3], '');
      assert.equal(req.session.error, undefined);
    });

    test('stores a null donor email when none is provided', async () => {
      stub.queueResults({ rows: [] });
      const req = createRequest({ body: donationBody(), session: {} });
      const res = createResponse();

      await donationsController.donate(req, res);

      const [insert] = stub.matching('INSERT INTO donations');
      assert.equal(insert.params[2], null);
      assert.equal(insert.params[3], null);
    });

    test('records a PIX donation without a receipt as pending payment', async () => {
      stub.queueResults({ rows: [] });
      const req = createRequest({ body: donationBody(), session: {} });
      const res = createResponse();

      await donationsController.donate(req, res);

      const [insert] = stub.matching('INSERT INTO donations');
      assert.equal(insert.params[4], 'pending_payment');
      assert.equal(insert.params[6], null);
      assert.equal(insert.params[7], null);
      assert.equal(req.session.success, 'Doação registrada! Faça a transferência PIX e envie o comprovante.');
    });

    test('records a PIX donation with a receipt for review', async () => {
      stub.queueResults({ rows: [] });
      const req = createRequest({
        body: donationBody({ amount: '125.5', donor_name: ' João Souza ', donor_email: 'JOAO@EXAMPLE.COM' }),
        file: { buffer: Buffer.from('receipt'), mimetype: 'image/png' },
        session: {},
      });
      const res = createResponse();

      await donationsController.donate(req, res);

      const [insert] = stub.matching('INSERT INTO donations');
      assert.deepEqual(insert.params.slice(0, 5), [
        '125.50',
        'pix',
        'João Souza',
        'joao@example.com',
        'pending_review',
      ]);
      assert.equal(insert.params[6].toString(), 'receipt');
      assert.equal(insert.params[7], 'image/png');
      assert.match(res.redirectPath, /^\/donate\/receipt\/[A-Z0-9]+-[A-Z0-9]+$/);
      assert.equal(req.session.formData, undefined);
      assert.match(req.session.success, /comprovante/);
    });

    test('remembers the receipt code in the session', async () => {
      stub.queueResults({ rows: [] });
      const req = createRequest({ body: donationBody(), session: {} });
      const res = createResponse();

      await donationsController.donate(req, res);

      const code = res.redirectPath.replace('/donate/receipt/', '');
      assert.deepEqual(req.session.donationReceiptCodes, [code]);
    });

    test('keeps the form data when the donation cannot be stored', async () => {
      stub.failNextQuery();
      const req = createRequest({ body: donationBody(), session: {} });
      const res = createResponse();

      await donationsController.donate(req, res);

      assert.equal(req.session.error, 'Erro ao processar doação. Tente novamente.');
      assert.equal(res.redirectPath, '/donate');
      assert.equal(req.session.formData.amount, '50');
    });
  });

  describe('donatePage', () => {
    test('prefills the donation form with the logged in adopter details', async () => {
      stub.queueResults({ rows: [{ key: 'pix_key', value: 'pix@ong.org' }] });
      const req = createRequest({ session: { adopter: { name: 'Ana Silva', email: 'ana@example.com' } } });
      const res = createResponse();

      await donationsController.donatePage(req, res);

      assert.equal(res.rendered.view, 'donations/form');
      assert.deepEqual(res.rendered.data.formData, {
        donor_name: 'Ana Silva',
        donor_email: 'ana@example.com',
      });
      assert.equal(res.rendered.data.pixKey, 'pix@ong.org');
    });

    test('prefers the previously submitted form data over the adopter profile', async () => {
      stub.queueResults({ rows: [] });
      const req = createRequest({
        session: {
          adopter: { name: 'Ana Silva', email: 'ana@example.com' },
          formData: { amount: '75', donor_name: 'Outro Nome' },
        },
      });
      const res = createResponse();

      await donationsController.donatePage(req, res);

      assert.deepEqual(res.rendered.data.formData, { amount: '75', donor_name: 'Outro Nome' });
      assert.equal(req.session.formData, undefined);
    });

    test('renders the donation form with empty settings when the settings query fails', async () => {
      stub.failNextQuery();
      const req = createRequest({ session: {} });
      const res = createResponse();

      await donationsController.donatePage(req, res);

      assert.equal(res.rendered.view, 'donations/form');
      assert.equal(res.rendered.data.pixKey, '');
      assert.equal(res.rendered.data.projectEmail, '');
    });
  });

  describe('uploadReceipt', () => {
    test('requires a file to upload a receipt', async () => {
      const req = createRequest({ params: { code: 'ABCD-123' }, session: {} });
      const res = createResponse();

      await donationsController.uploadReceipt(req, res);

      assert.equal(stub.calls.length, 0);
      assert.equal(req.session.error, 'Selecione uma imagem do comprovante.');
      assert.equal(res.redirectPath, '/donate/receipt/ABCD-123');
    });

    test('reports an unknown receipt code', async () => {
      stub.queueResults({ rows: [] });
      const req = createRequest({
        params: { code: 'NOPE-000' },
        file: { buffer: Buffer.from('receipt'), mimetype: 'image/png' },
        session: {},
      });
      const res = createResponse();

      await donationsController.uploadReceipt(req, res);

      assert.equal(req.session.error, 'Doação não encontrada.');
      assert.equal(res.redirectPath, '/donate');
    });

    test('uploads a PIX receipt and moves the donation to review', async () => {
      stub.queueResults({ rows: [{ id: 3 }] });
      const req = createRequest({
        params: { code: 'ABCD-123' },
        file: { buffer: Buffer.from('receipt'), mimetype: 'application/pdf' },
        session: {},
      });
      const res = createResponse();

      await donationsController.uploadReceipt(req, res);

      const [update] = stub.matching('UPDATE donations SET receipt_image');
      assert.deepEqual(update.params, [Buffer.from('receipt'), 'application/pdf', 'ABCD-123']);
      assert.equal(req.session.success, 'Comprovante enviado com sucesso! Aguarde a confirmação da ONG.');
      assert.equal(res.redirectPath, '/donate/receipt/ABCD-123');
      assert.deepEqual(req.session.donationReceiptCodes, ['ABCD-123']);
    });

    test('does not duplicate a receipt code already in the session', async () => {
      stub.queueResults({ rows: [{ id: 3 }] });
      const req = createRequest({
        params: { code: 'ABCD-123' },
        file: { buffer: Buffer.from('receipt'), mimetype: 'image/png' },
        session: { donationReceiptCodes: ['ABCD-123'] },
      });
      const res = createResponse();

      await donationsController.uploadReceipt(req, res);

      assert.deepEqual(req.session.donationReceiptCodes, ['ABCD-123']);
    });

    test('reports a failure when the receipt cannot be stored', async () => {
      stub.failNextQuery();
      const req = createRequest({
        params: { code: 'ABCD-123' },
        file: { buffer: Buffer.from('receipt'), mimetype: 'image/png' },
        session: {},
      });
      const res = createResponse();

      await donationsController.uploadReceipt(req, res);

      assert.equal(req.session.error, 'Erro ao enviar comprovante.');
      assert.equal(res.redirectPath, '/donate/receipt/ABCD-123');
    });
  });

  describe('receiptPage', () => {
    test('reports an unknown receipt code', async () => {
      stub.queueResults({ rows: [] });
      const req = createRequest({ params: { code: 'NOPE-000' }, session: {} });
      const res = createResponse();

      await donationsController.receiptPage(req, res);

      assert.equal(req.session.error, 'Comprovante não encontrado.');
      assert.equal(res.redirectPath, '/donate');
    });

    test('blocks a visitor with no claim to the receipt', async () => {
      stub.queueResults({ rows: [donationRow()] });
      const req = createRequest({ params: { code: 'ABCD-123' }, session: {} });
      const res = createResponse();

      await donationsController.receiptPage(req, res);

      assert.equal(req.session.error, 'Você não tem acesso a este comprovante.');
      assert.equal(res.redirectPath, '/donate');
    });

    test('shows the receipt to an authenticated ong user', async () => {
      stub.queueResults({ rows: [donationRow()] }, { rows: [] });
      const req = createRequest({ params: { code: 'ABCD-123' }, session: { user: { id: 1 } } });
      const res = createResponse();

      await donationsController.receiptPage(req, res);

      assert.equal(res.rendered.view, 'donations/receipt');
      assert.equal(res.rendered.data.donation.receipt_code, 'ABCD-123');
    });

    test('shows the receipt to the adopter who owns the donor email', async () => {
      stub.queueResults({ rows: [donationRow()] }, { rows: [] });
      const req = createRequest({
        params: { code: 'ABCD-123' },
        session: { adopter: { email: 'JOAO@example.com' } },
      });
      const res = createResponse();

      await donationsController.receiptPage(req, res);

      assert.equal(res.rendered.view, 'donations/receipt');
    });

    test('shows the receipt to the anonymous donor who created it', async () => {
      stub.queueResults({ rows: [donationRow()] }, { rows: [] });
      const req = createRequest({
        params: { code: 'ABCD-123' },
        session: { donationReceiptCodes: ['ABCD-123'] },
      });
      const res = createResponse();

      await donationsController.receiptPage(req, res);

      assert.equal(res.rendered.view, 'donations/receipt');
    });

    test('reports a failure when the receipt query fails', async () => {
      stub.failNextQuery();
      const req = createRequest({ params: { code: 'ABCD-123' }, session: {} });
      const res = createResponse();

      await donationsController.receiptPage(req, res);

      assert.equal(req.session.error, 'Erro ao carregar comprovante.');
      assert.equal(res.redirectPath, '/donate');
    });
  });

  describe('serveReceiptImage', () => {
    test('returns not found when the donation has no stored image', async () => {
      stub.queueResults({ rows: [donationRow({ receipt_image: null })] });
      const req = createRequest({ params: { id: '3' }, session: { user: { id: 1 } } });
      const res = createResponse();

      await donationsController.serveReceiptImage(req, res);

      assert.equal(res.statusCode, 404);
      assert.equal(res.body, 'Comprovante não encontrado.');
    });

    test('refuses the image to a visitor with no claim to it', async () => {
      stub.queueResults({ rows: [donationRow()] });
      const req = createRequest({ params: { id: '3' }, session: {} });
      const res = createResponse();

      await donationsController.serveReceiptImage(req, res);

      assert.equal(res.statusCode, 403);
      assert.equal(res.body, 'Acesso não autorizado.');
    });

    test('serves the stored image with its mime type', async () => {
      stub.queueResults({ rows: [donationRow({ receipt_image_mime_type: 'application/pdf' })] });
      const req = createRequest({ params: { id: '3' }, session: { user: { id: 1 } } });
      const res = createResponse();

      await donationsController.serveReceiptImage(req, res);

      assert.equal(res.headers['content-type'], 'application/pdf');
      assert.equal(res.body.toString(), 'receipt');
    });

    test('falls back to png when the stored mime type is missing', async () => {
      stub.queueResults({ rows: [donationRow({ receipt_image_mime_type: null })] });
      const req = createRequest({ params: { id: '3' }, session: { user: { id: 1 } } });
      const res = createResponse();

      await donationsController.serveReceiptImage(req, res);

      assert.equal(res.headers['content-type'], 'image/png');
    });

    test('returns a server error when the image query fails', async () => {
      stub.failNextQuery();
      const req = createRequest({ params: { id: '3' }, session: { user: { id: 1 } } });
      const res = createResponse();

      await donationsController.serveReceiptImage(req, res);

      assert.equal(res.statusCode, 500);
      assert.equal(res.body, 'Erro interno');
    });
  });

  describe('admin panel', () => {
    test('lists the donations with the completed balance', async () => {
      stub.queueResults(
        { rows: [donationRow({ status: 'completed' })] },
        { rows: [{ total: '250.00' }] },
      );
      const req = createRequest({ session: { user: { id: 1 } } });
      const res = createResponse();

      await donationsController.adminList(req, res);

      assert.equal(res.rendered.view, 'admin/donations');
      assert.equal(res.rendered.data.donations.length, 1);
      assert.equal(res.rendered.data.totalBalance, 250);
    });

    test('shows a zero balance when no donation is completed', async () => {
      stub.queueResults({ rows: [] }, { rows: [{ total: null }] });
      const req = createRequest({ session: { user: { id: 1 } } });
      const res = createResponse();

      await donationsController.adminList(req, res);

      assert.equal(res.rendered.data.totalBalance, 0);
    });

    test('renders an empty donation list when the query fails', async () => {
      stub.failNextQuery();
      const req = createRequest({ session: { user: { id: 1 } } });
      const res = createResponse();

      await donationsController.adminList(req, res);

      assert.deepEqual(res.rendered.data.donations, []);
      assert.equal(res.rendered.data.totalBalance, 0);
    });

    test('refuses an unknown donation status', async () => {
      const req = createRequest({
        body: { status: 'refunded' },
        params: { id: '3' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await donationsController.updateStatus(req, res);

      assert.equal(stub.calls.length, 0);
      assert.equal(req.session.error, 'Status inválido.');
      assert.equal(res.redirectPath, '/admin/donations');
    });

    test('confirms a PIX donation and records the audit entry', async () => {
      stub.queueResults({ rows: [] }, { rows: [] });
      const req = createRequest({
        body: { status: 'completed' },
        params: { id: '3' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await donationsController.updateStatus(req, res);

      const [update] = stub.matching('UPDATE donations SET status = $1');
      assert.deepEqual(update.params, ['completed', '3']);
      const [audit] = stub.matching('INSERT INTO audit_logs');
      assert.deepEqual(audit.params, [1, '3', JSON.stringify({ status: 'completed' })]);
      assert.equal(req.session.success, 'Doação confirmada com sucesso!');
    });

    test('rejects a PIX donation and records the audit entry', async () => {
      stub.queueResults({ rows: [] }, { rows: [] });
      const req = createRequest({
        body: { status: 'rejected' },
        params: { id: '3' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await donationsController.updateStatus(req, res);

      assert.equal(stub.matching('INSERT INTO audit_logs').length, 1);
      assert.equal(req.session.success, 'Doação rejeitada com sucesso!');
    });

    test('reports a failure when the donation update fails', async () => {
      stub.failNextQuery();
      const req = createRequest({
        body: { status: 'completed' },
        params: { id: '3' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await donationsController.updateStatus(req, res);

      assert.equal(req.session.error, 'Erro ao atualizar doação.');
      assert.equal(res.redirectPath, '/admin/donations');
    });
  });
});
