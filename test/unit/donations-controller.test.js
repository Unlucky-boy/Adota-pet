const assert = require('node:assert/strict');
const { describe, test, beforeEach, afterEach } = require('node:test');

const { createRequest, createResponse, stubDb } = require('../helpers/controller-harness');
const donationsController = require('../../src/backend/controllers/donationsController');

describe('donations controller', () => {
  let stub;

  beforeEach(() => {
    stub = stubDb();
  });

  afterEach(() => {
    stub.restore();
  });

  test('rejects invalid donation amounts before touching the database', async () => {
    const req = createRequest({ body: { amount: '0', payment_method: 'pix' }, session: {} });
    const res = createResponse();

    await donationsController.donate(req, res);

    assert.equal(stub.calls.length, 0);
    assert.equal(req.session.error, 'Informe um valor válido para a doação.');
    assert.equal(res.redirectPath, '/donate');
    assert.deepEqual(req.session.formData, {
      amount: '0',
      payment_method: 'pix',
      donor_name: undefined,
      donor_email: undefined,
    });
  });

  test('records a PIX donation with a receipt for review', async () => {
    stub.queueResults({ rows: [] });
    const req = createRequest({
      body: {
        amount: '125.5',
        payment_method: 'pix',
        donor_name: ' João Souza ',
        donor_email: 'JOAO@EXAMPLE.COM',
      },
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

  test('rejects an invalid donor email before inserting a donation', async () => {
    const req = createRequest({
      body: { amount: '50', payment_method: 'pix', donor_email: 'invalid-email' },
      session: {},
    });
    const res = createResponse();

    await donationsController.donate(req, res);

    assert.equal(stub.calls.length, 0);
    assert.equal(req.session.error, 'E-mail do doador inválido.');
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
  });
});
