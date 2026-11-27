const assert = require('node:assert/strict');
const { describe, test, beforeEach, afterEach } = require('node:test');

const {
  createRequest, createResponse, captureConsoleError, stubDb,
} = require('../helpers/controller-harness');
const volunteersController = require('../../src/backend/controllers/volunteersController');

const REQUIRED = 'Nome, e-mail, telefone e disponibilidade são obrigatórios.';

function validVolunteer(overrides = {}) {
  return {
    name: ' Ana Silva ',
    email: ' Ana@Example.com ',
    phone: '(11) 99999-8888',
    availability: ' Sábados ',
    motivation: ' Amo animais ',
    ...overrides,
  };
}

describe('volunteers controller', () => {
  let stub;
  let consoleError;

  beforeEach(() => {
    stub = stubDb();
    consoleError = captureConsoleError();
  });

  afterEach(() => {
    stub.restore();
    consoleError.restore();
  });

  describe('formPage', () => {
    test('restores preserved form data and clears it from the session', () => {
      const formData = { name: 'Ana', phone: '11999998888' };
      const req = createRequest({ session: { formData } });
      const res = createResponse();

      volunteersController.formPage(req, res);

      assert.equal(res.rendered.view, 'volunteer/form');
      assert.deepEqual(res.rendered.data.formData, formData);
      assert.equal(req.session.formData, undefined);
    });

    test('prefills name and e-mail from the logged-in adopter', () => {
      const req = createRequest({
        session: { adopter: { id: 4, name: 'Bia', email: 'bia@example.com' } },
      });
      const res = createResponse();

      volunteersController.formPage(req, res);

      assert.deepEqual(res.rendered.data.formData, { name: 'Bia', email: 'bia@example.com' });
    });

    test('renders an empty form for anonymous visitors', () => {
      const res = createResponse();

      volunteersController.formPage(createRequest(), res);

      assert.deepEqual(res.rendered.data.formData, {});
    });
  });

  describe('register', () => {
    test('inserts an anonymous volunteer with normalized fields', async () => {
      const req = createRequest({ body: validVolunteer(), session: {} });
      const res = createResponse();

      await volunteersController.register(req, res);

      assert.deepEqual(stub.matching('SELECT id FROM volunteers')[0].params, ['ana@example.com']);
      const [insert] = stub.matching('INSERT INTO volunteers');
      assert.deepEqual(insert.params, [
        null, 'Ana Silva', 'ana@example.com', '(11) 99999-8888', 'Sábados', 'Amo animais',
      ]);
      assert.equal(req.session.formData, undefined);
      assert.equal(req.session.success, 'Inscrição de voluntariado enviada com sucesso!');
      assert.equal(res.redirectPath, '/volunteer/success');
    });

    test('uses the adopter identity instead of the submitted name and e-mail', async () => {
      const req = createRequest({
        body: validVolunteer({ name: 'Outro', email: 'outro@example.com' }),
        session: { adopter: { id: 9, name: 'Bia', email: 'bia@example.com' } },
      });

      await volunteersController.register(req, createResponse());

      const [insert] = stub.matching('INSERT INTO volunteers');
      assert.deepEqual(insert.params.slice(0, 3), [9, 'Bia', 'bia@example.com']);
    });

    test('stores a null motivation when it is omitted', async () => {
      const req = createRequest({ body: validVolunteer({ motivation: '' }), session: {} });

      await volunteersController.register(req, createResponse());

      assert.equal(stub.matching('INSERT INTO volunteers')[0].params[5], null);
    });

    for (const field of ['name', 'email', 'phone', 'availability']) {
      test(`requires ${field} and preserves the typed data`, async () => {
        const body = validVolunteer({ [field]: '' });
        const req = createRequest({ body, session: {} });
        const res = createResponse();

        await volunteersController.register(req, res);

        assert.equal(stub.calls.length, 0);
        assert.equal(req.session.error, REQUIRED);
        assert.equal(req.session.formData.motivation, body.motivation);
        assert.equal(res.redirectPath, '/volunteer');
      });
    }

    test('rejects an invalid e-mail', async () => {
      const req = createRequest({ body: validVolunteer({ email: 'ana@' }), session: {} });
      const res = createResponse();

      await volunteersController.register(req, res);

      assert.equal(stub.calls.length, 0);
      assert.equal(req.session.error, 'E-mail inválido. Verifique e tente novamente.');
      assert.equal(res.redirectPath, '/volunteer');
    });

    test('rejects an invalid phone', async () => {
      const req = createRequest({ body: validVolunteer({ phone: '1111111111' }), session: {} });
      const res = createResponse();

      await volunteersController.register(req, res);

      assert.equal(stub.calls.length, 0);
      assert.equal(req.session.error, 'Telefone inválido. Informe um telefone brasileiro válido.');
    });

    test('rejects an e-mail that already has an application', async () => {
      stub.queueResults({ rows: [{ id: 1 }] });
      const req = createRequest({ body: validVolunteer(), session: {} });
      const res = createResponse();

      await volunteersController.register(req, res);

      assert.equal(stub.matching('INSERT INTO volunteers').length, 0);
      assert.equal(req.session.error, 'Este e-mail já possui uma inscrição de voluntariado.');
      assert.ok(req.session.formData);
      assert.equal(res.redirectPath, '/volunteer');
    });

    test('reports a database failure and keeps the typed data', async () => {
      stub.failNextQuery();
      const req = createRequest({ body: validVolunteer(), session: {} });
      const res = createResponse();

      await volunteersController.register(req, res);

      assert.equal(req.session.error, 'Erro interno. Tente novamente mais tarde.');
      assert.ok(req.session.formData);
      assert.equal(res.redirectPath, '/volunteer');
    });
  });

  test('successPage renders the confirmation', () => {
    const res = createResponse();

    volunteersController.successPage(createRequest(), res);

    assert.equal(res.rendered.view, 'volunteer/success');
  });

  describe('adminList', () => {
    test('lists every volunteer and aggregates the counters', async () => {
      stub.queueResults(
        { rows: [{ id: 1 }, { id: 2 }] },
        { rows: [{ status: 'pending', count: 3 }, { status: 'approved', count: 2 }] },
      );
      const res = createResponse();

      await volunteersController.adminList(createRequest(), res);

      assert.deepEqual(stub.paramsOf(0), []);
      assert.equal(res.rendered.view, 'admin/volunteers');
      assert.equal(res.rendered.data.statusFilter, 'all');
      assert.equal(res.rendered.data.volunteers.length, 2);
      assert.deepEqual(res.rendered.data.counts, {
        pending: 3, approved: 2, rejected: 0, total: 5,
      });
    });

    test('filters by the requested status', async () => {
      const res = createResponse();

      await volunteersController.adminList(createRequest({ query: { status: 'approved' } }), res);

      assert.deepEqual(stub.paramsOf(0), ['approved']);
      assert.equal(res.rendered.data.statusFilter, 'approved');
    });

    test('renders an empty list when the database fails', async () => {
      stub.failNextQuery();
      const res = createResponse();

      await volunteersController.adminList(createRequest({ query: { status: 'pending' } }), res);

      assert.deepEqual(res.rendered.data.volunteers, []);
      assert.equal(res.rendered.data.statusFilter, 'all');
      assert.deepEqual(res.rendered.data.counts, {
        pending: 0, approved: 0, rejected: 0, total: 0,
      });
    });
  });

  describe('updateStatus', () => {
    const labels = {
      approved: 'Voluntário aprovado com sucesso!',
      rejected: 'Voluntário rejeitado com sucesso!',
      pending: 'Voluntário marcado como pendente com sucesso!',
    };

    for (const [status, message] of Object.entries(labels)) {
      test(`sets the status to ${status} and writes an audit entry`, async () => {
        const req = createRequest({
          params: { id: '12' }, body: { status }, session: { user: { id: 1 } },
        });
        const res = createResponse();

        await volunteersController.updateStatus(req, res);

        assert.deepEqual(stub.matching('UPDATE volunteers')[0].params, [status, 1, '12']);
        const [audit] = stub.matching('INSERT INTO audit_logs');
        assert.deepEqual(audit.params, [1, '12', JSON.stringify({ status })]);
        assert.equal(req.session.success, message);
        assert.equal(res.redirectPath, '/admin/volunteers');
      });
    }

    test('rejects an unknown status before database access', async () => {
      const req = createRequest({
        params: { id: '12' }, body: { status: 'banned' }, session: { user: { id: 1 } },
      });
      const res = createResponse();

      await volunteersController.updateStatus(req, res);

      assert.equal(stub.calls.length, 0);
      assert.equal(req.session.error, 'Status inválido.');
      assert.equal(res.redirectPath, '/admin/volunteers');
    });

    test('rejects an invalid id before database access', async () => {
      const req = createRequest({
        params: { id: 'abc' }, body: { status: 'approved' }, session: { user: { id: 1 } },
      });

      await volunteersController.updateStatus(req, createResponse());

      assert.equal(stub.calls.length, 0);
      assert.equal(req.session.error, 'Status inválido.');
    });

    test('reports a database failure', async () => {
      stub.failNextQuery();
      const req = createRequest({
        params: { id: '12' }, body: { status: 'approved' }, session: { user: { id: 1 } },
      });
      const res = createResponse();

      await volunteersController.updateStatus(req, res);

      assert.equal(stub.matching('INSERT INTO audit_logs').length, 0);
      assert.equal(req.session.error, 'Erro ao atualizar status.');
      assert.equal(res.redirectPath, '/admin/volunteers');
    });
  });
});
