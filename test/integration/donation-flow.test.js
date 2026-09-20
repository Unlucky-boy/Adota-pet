const assert = require('node:assert/strict');
const { describe, test, before, beforeEach, after } = require('node:test');

const integrationDb = require('../helpers/integration-db');
const { anonymous, asAdmin } = require('../helpers/integration-agent');

const {
  skip, seedBaseline, resetDatabase, close, insertDonation, rowsOf,
} = integrationDb;

const RECEIPT = Buffer.from('conteudo-do-comprovante');

/** Extrai o código do comprovante do Location devolvido por POST /donate. */
function receiptCodeOf(response) {
  return response.headers.location.replace('/donate/receipt/', '');
}

describe('donation flow', { skip }, () => {
  let adminAgent;

  before(async () => {
    await resetDatabase();
    await seedBaseline();
    adminAgent = await asAdmin();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  after(async () => {
    await close();
  });

  test('registers a PIX donation awaiting payment', async () => {
    const response = await anonymous()
      .post('/donate')
      .type('form')
      .send({ amount: '50', payment_method: 'pix', donor_name: 'João Souza', donor_email: 'joao@example.com' })
      .expect(302);

    assert.match(response.headers.location, /^\/donate\/receipt\/[A-Z0-9]+-[A-Z0-9]+$/);

    const donations = await rowsOf('SELECT amount, status, receipt_image FROM donations');
    assert.equal(donations.length, 1);
    assert.equal(donations[0].amount, '50.00');
    assert.equal(donations[0].status, 'pending_payment');
    assert.equal(donations[0].receipt_image, null);
  });

  test('registers a PIX donation with a receipt awaiting review', async () => {
    await anonymous()
      .post('/donate')
      .field('amount', '75.5')
      .field('payment_method', 'pix')
      .field('donor_email', 'joao@example.com')
      .attach('receipt_image', RECEIPT, { filename: 'comprovante.png', contentType: 'image/png' })
      .expect(302);

    const [donation] = await rowsOf(
      'SELECT amount, status, receipt_image, receipt_image_mime_type FROM donations',
    );
    assert.equal(donation.amount, '75.50');
    assert.equal(donation.status, 'pending_review');
    assert.equal(donation.receipt_image.toString(), RECEIPT.toString());
    assert.equal(donation.receipt_image_mime_type, 'image/png');
  });

  test('rejects a donation above the maximum amount', async () => {
    const response = await anonymous()
      .post('/donate')
      .type('form')
      .send({ amount: '150000', payment_method: 'pix' })
      .expect(302);

    assert.equal(response.headers.location, '/donate');
    assert.equal((await rowsOf('SELECT id FROM donations')).length, 0);
  });

  test('rejects a donation with an invalid donor email', async () => {
    const response = await anonymous()
      .post('/donate')
      .type('form')
      .send({ amount: '50', payment_method: 'pix', donor_email: 'nao-e-email' })
      .expect(302);

    assert.equal(response.headers.location, '/donate');
    assert.equal((await rowsOf('SELECT id FROM donations')).length, 0);
  });

  test('shows the receipt to the session that created it', async () => {
    const donor = anonymous();
    const created = await donor
      .post('/donate')
      .type('form')
      .send({ amount: '50', payment_method: 'pix' })
      .expect(302);

    await donor.get(`/donate/receipt/${receiptCodeOf(created)}`).expect(200);
  });

  test('hides the receipt from a different visitor', async () => {
    const created = await anonymous()
      .post('/donate')
      .type('form')
      .send({ amount: '50', payment_method: 'pix' })
      .expect(302);

    const response = await anonymous()
      .get(`/donate/receipt/${receiptCodeOf(created)}`)
      .expect(302);

    assert.equal(response.headers.location, '/donate');
  });

  test('shows the receipt to the ong after login', async () => {
    const created = await anonymous()
      .post('/donate')
      .type('form')
      .send({ amount: '50', payment_method: 'pix' })
      .expect(302);

    await adminAgent.get(`/donate/receipt/${receiptCodeOf(created)}`).expect(200);
  });

  test('attaching a receipt later moves the donation to review', async () => {
    const donor = anonymous();
    const created = await donor
      .post('/donate')
      .type('form')
      .send({ amount: '50', payment_method: 'pix' })
      .expect(302);
    const code = receiptCodeOf(created);

    await donor
      .post(`/donate/receipt/${code}/upload`)
      .attach('receipt_image', RECEIPT, { filename: 'comprovante.png', contentType: 'image/png' })
      .expect(302);

    const [donation] = await rowsOf(
      'SELECT status, receipt_image FROM donations WHERE receipt_code = $1',
      [code],
    );
    assert.equal(donation.status, 'pending_review');
    assert.equal(donation.receipt_image.toString(), RECEIPT.toString());
  });

  test('reports an unknown code when attaching a receipt', async () => {
    await insertDonation({ receipt_code: 'REAL-0001' });

    const response = await anonymous()
      .post('/donate/receipt/NOPE-0000/upload')
      .attach('receipt_image', RECEIPT, { filename: 'comprovante.png', contentType: 'image/png' })
      .expect(302);

    assert.equal(response.headers.location, '/donate');
    const [donation] = await rowsOf('SELECT status FROM donations WHERE receipt_code = $1', ['REAL-0001']);
    assert.equal(donation.status, 'pending_payment');
  });

  test('refuses to serve a receipt image to an unrelated visitor', async () => {
    const donationId = await insertDonation({
      status: 'pending_review',
      receipt_image: RECEIPT,
      receipt_image_mime_type: 'image/png',
    });

    await anonymous().get(`/donations/${donationId}/receipt-image`).expect(403);
  });

  test('serves the receipt image to the donor session', async () => {
    const donor = anonymous();
    const created = await donor
      .post('/donate')
      .field('amount', '50')
      .field('payment_method', 'pix')
      .attach('receipt_image', RECEIPT, { filename: 'comprovante.png', contentType: 'image/png' })
      .expect(302);
    const [donation] = await rowsOf('SELECT id FROM donations WHERE receipt_code = $1', [
      receiptCodeOf(created),
    ]);

    const response = await donor.get(`/donations/${donation.id}/receipt-image`).expect(200);

    assert.match(response.headers['content-type'], /image\/png/);
    assert.equal(response.body.length, RECEIPT.length);
  });

  test('confirming a PIX donation records the change in the audit log', async () => {
    const donationId = await insertDonation({ status: 'pending_review' });

    await adminAgent
      .post(`/admin/donations/${donationId}/status`)
      .type('form')
      .send({ status: 'completed' })
      .expect(302);

    const [donation] = await rowsOf('SELECT status FROM donations WHERE id = $1', [donationId]);
    assert.equal(donation.status, 'completed');

    const logs = await rowsOf(
      "SELECT entity_id, metadata FROM audit_logs WHERE action = 'donation_status_changed'",
    );
    assert.equal(logs.length, 1);
    assert.equal(logs[0].entity_id, donationId);
    assert.deepEqual(logs[0].metadata, { status: 'completed' });
  });

  test('counts only the completed donations in the admin balance', async () => {
    await insertDonation({ amount: '120.00', status: 'completed', receipt_code: 'DONE-0001' });
    await insertDonation({ amount: '500.00', status: 'pending_review', receipt_code: 'WAIT-0001' });

    const response = await adminAgent.get('/admin/donations').expect(200);

    assert.match(response.text, /120[.,]00/);
    assert.doesNotMatch(response.text, /620[.,]00/);
  });

  test('blocks an anonymous request from confirming a donation', async () => {
    const donationId = await insertDonation({ status: 'pending_review' });

    const response = await anonymous()
      .post(`/admin/donations/${donationId}/status`)
      .type('form')
      .send({ status: 'completed' })
      .expect(302);

    assert.equal(response.headers.location, '/login');
    const [donation] = await rowsOf('SELECT status FROM donations WHERE id = $1', [donationId]);
    assert.equal(donation.status, 'pending_review');
  });
});
