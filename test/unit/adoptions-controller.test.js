const assert = require('node:assert/strict');
const { describe, test, beforeEach, afterEach } = require('node:test');

const { createRequest, createResponse, stubDb } = require('../helpers/controller-harness');
const adoptionsController = require('../../src/backend/controllers/adoptionsController');

/** Linha devolvida pelo SELECT ... FOR UPDATE de updateStatus/confirmDelivery. */
function lockedAdoption(overrides = {}) {
  return {
    id: 12,
    pet_id: 7,
    adoption_status: 'pending',
    pet_status: 'available',
    ...overrides,
  };
}

describe('adoptions controller', () => {
  let stub;

  beforeEach(() => {
    stub = stubDb();
  });

  afterEach(() => {
    stub.restore();
  });

  describe('create', () => {
    test('creates an adoption request for an available pet', async () => {
      stub.queueResults(
        { rows: [{ id: 7, status: 'available' }] },
        { rows: [{ id: 21 }] },
        { rows: [] },
      );
      const req = createRequest({
        body: {
          pet_id: '7',
          adopter_name: 'Ana Silva',
          adopter_email: 'ana@example.com',
          adopter_phone: '11999999999',
          adopter_address: 'Rua A, 10',
          message: 'Quero oferecer um lar.',
        },
        session: {},
      });
      const res = createResponse();

      await adoptionsController.create(req, res);

      const [insert] = stub.matching('INSERT INTO adoptions');
      assert.deepEqual(insert.params, [
        '7',
        'Ana Silva',
        'ana@example.com',
        '11999999999',
        'Rua A, 10',
        'Quero oferecer um lar.',
      ]);
      const [history] = stub.matching('INSERT INTO adoption_status_history');
      assert.deepEqual(history.params, [21]);
      assert.equal(req.session.success, 'Solicitação de adoção enviada com sucesso! Entraremos em contato.');
      assert.equal(res.redirectPath, '/adoptions/success');
    });

    test('rejects an adoption request when the pet is unavailable', async () => {
      stub.queueResults({ rows: [] });
      const req = createRequest({
        body: { pet_id: '8', adopter_name: 'Ana Silva', adopter_email: 'ana@example.com' },
        session: {},
      });
      const res = createResponse();

      await adoptionsController.create(req, res);

      assert.equal(stub.matching('INSERT INTO adoptions').length, 0);
      assert.equal(req.session.error, 'Este pet não está mais disponível para adoção.');
      assert.equal(res.redirectPath, '/pets');
    });

    test('fills the missing contact details from the logged in adopter profile', async () => {
      stub.queueResults(
        { rows: [{ phone: '11988887777', address: 'Rua do Perfil, 55' }] },
        { rows: [{ id: 7, status: 'available' }] },
        { rows: [{ id: 22 }] },
        { rows: [] },
      );
      const req = createRequest({
        body: { pet_id: '7', adopter_name: 'Ana Silva', adopter_email: 'ana@example.com' },
        session: { adopter: { id: 3 } },
      });
      const res = createResponse();

      await adoptionsController.create(req, res);

      const [profile] = stub.matching('FROM adopters');
      assert.deepEqual(profile.params, [3]);
      const [insert] = stub.matching('INSERT INTO adoptions');
      assert.deepEqual(insert.params.slice(3), [
        '11988887777',
        'Rua do Perfil, 55',
        'Intenção de adoção registrada via sistema (Usuário Logado).',
      ]);
      assert.equal(res.redirectPath, '/adoptions/success');
    });

    test('keeps the submitted contact details when the logged in adopter provides them', async () => {
      stub.queueResults(
        { rows: [{ id: 7, status: 'available' }] },
        { rows: [{ id: 23 }] },
        { rows: [] },
      );
      const req = createRequest({
        body: {
          pet_id: '7',
          adopter_name: 'Ana Silva',
          adopter_email: 'ana@example.com',
          adopter_phone: '11977776666',
          adopter_address: 'Rua Informada, 99',
          message: 'Mensagem própria.',
        },
        session: { adopter: { id: 3 } },
      });
      const res = createResponse();

      await adoptionsController.create(req, res);

      assert.equal(stub.matching('FROM adopters').length, 0);
      const [insert] = stub.matching('INSERT INTO adoptions');
      assert.deepEqual(insert.params.slice(3), [
        '11977776666',
        'Rua Informada, 99',
        'Mensagem própria.',
      ]);
    });

    test('falls back to the submitted data when the adopter profile is missing', async () => {
      stub.queueResults(
        { rows: [] },
        { rows: [{ id: 7, status: 'available' }] },
        { rows: [{ id: 24 }] },
        { rows: [] },
      );
      const req = createRequest({
        body: { pet_id: '7', adopter_name: 'Ana Silva', adopter_email: 'ana@example.com' },
        session: { adopter: { id: 99 } },
      });
      const res = createResponse();

      await adoptionsController.create(req, res);

      const [insert] = stub.matching('INSERT INTO adoptions');
      assert.deepEqual(insert.params.slice(3), [undefined, undefined, undefined]);
      assert.equal(res.redirectPath, '/adoptions/success');
    });

    test('redirects back to the pet page when the request cannot be stored', async () => {
      stub.queueResults({ rows: [{ id: 7, status: 'available' }] });
      stub.failNextQuery();
      const req = createRequest({
        body: { pet_id: '7', adopter_name: 'Ana Silva', adopter_email: 'ana@example.com' },
        session: {},
      });
      const res = createResponse();

      await adoptionsController.create(req, res);

      assert.equal(req.session.error, 'Erro ao enviar solicitação. Tente novamente.');
      assert.equal(res.redirectPath, '/pets/7');
    });
  });

  describe('updateStatus', () => {
    test('refuses an unknown status without touching the database', async () => {
      const req = createRequest({
        body: { status: 'deleted' },
        params: { id: '12' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await adoptionsController.updateStatus(req, res);

      assert.equal(stub.calls.length, 0);
      assert.equal(req.session.error, 'Status inválido.');
      assert.equal(res.redirectPath, '/admin/adoptions');
    });

    test('reports a missing adoption', async () => {
      stub.queueResults({ rows: [] });
      const req = createRequest({
        body: { status: 'approved' },
        params: { id: '404' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await adoptionsController.updateStatus(req, res);

      assert.equal(stub.matching('UPDATE adoptions').length, 0);
      assert.equal(req.session.error, 'Solicitação de adoção não encontrada.');
      assert.equal(res.redirectPath, '/admin/adoptions');
    });

    test('approving an adoption reserves the related pet', async () => {
      stub.queueResults(
        { rows: [lockedAdoption()] },
        { rows: [] },
        { rows: [] },
        { rows: [] },
        { rows: [] },
        { rows: [] },
      );
      const req = createRequest({
        body: { status: 'approved' },
        params: { id: '12' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await adoptionsController.updateStatus(req, res);

      const [update] = stub.matching('UPDATE adoptions SET status = $1');
      assert.deepEqual(update.params, ['approved', 12]);
      const [reserve] = stub.matching("UPDATE pets SET status = 'reserved'");
      assert.deepEqual(reserve.params, [7]);
      const [history] = stub.matching('INSERT INTO adoption_status_history (adoption_id, old_status, new_status, changed_by) VALUES');
      assert.deepEqual(history.params, [12, 'pending', 'approved', 1]);
      const [audit] = stub.matching('INSERT INTO audit_logs');
      assert.deepEqual(audit.params, [1, 12, JSON.stringify({ oldStatus: 'pending', newStatus: 'approved' })]);
      assert.equal(req.session.success, 'Solicitação aprovada!');
      assert.equal(res.redirectPath, '/admin/adoptions');
    });

    test('auto rejects the competing requests when an adoption is approved', async () => {
      stub.queueResults(
        { rows: [lockedAdoption()] },
        { rows: [] },
        { rows: [] },
        { rows: [] },
        { rows: [] },
        { rows: [] },
      );
      const req = createRequest({
        body: { status: 'approved' },
        params: { id: '12' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await adoptionsController.updateStatus(req, res);

      const [autoReject] = stub.matching('WITH rejected AS');
      assert.deepEqual(autoReject.params, [7, 12, 1]);
    });

    test('does not approve an adoption for a reserved pet', async () => {
      stub.queueResults({ rows: [lockedAdoption({ id: 13, pet_status: 'reserved' })] });
      const req = createRequest({
        body: { status: 'approved' },
        params: { id: '13' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await adoptionsController.updateStatus(req, res);

      assert.equal(stub.matching('UPDATE adoptions').length, 0);
      assert.equal(stub.matching('UPDATE pets').length, 0);
      assert.equal(req.session.error, 'Este pet não está disponível para aprovação.');
      assert.equal(res.redirectPath, '/admin/adoptions');
    });

    test('allows re approving an adoption that already reserved its pet', async () => {
      stub.queueResults(
        { rows: [lockedAdoption({ adoption_status: 'approved', pet_status: 'reserved' })] },
        { rows: [] },
        { rows: [] },
        { rows: [] },
        { rows: [] },
        { rows: [] },
        { rows: [] },
      );
      const req = createRequest({
        body: { status: 'approved' },
        params: { id: '12' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await adoptionsController.updateStatus(req, res);

      assert.equal(stub.matching("UPDATE pets SET status = 'reserved'").length, 1);
      assert.equal(req.session.success, 'Solicitação aprovada!');
    });

    test('does not approve when another adoption for the same pet is approved', async () => {
      stub.queueResults(
        { rows: [lockedAdoption()] },
        { rows: [{ id: 99 }] },
      );
      const req = createRequest({
        body: { status: 'approved' },
        params: { id: '12' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await adoptionsController.updateStatus(req, res);

      assert.equal(stub.matching('UPDATE adoptions').length, 0);
      assert.equal(req.session.error, 'Este pet não está disponível para aprovação.');
    });

    test('rejecting an approved adoption releases the pet', async () => {
      stub.queueResults(
        { rows: [lockedAdoption({ adoption_status: 'approved', pet_status: 'reserved' })] },
        { rows: [] },
        { rows: [] },
        { rows: [] },
        { rows: [] },
      );
      const req = createRequest({
        body: { status: 'rejected' },
        params: { id: '12' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await adoptionsController.updateStatus(req, res);

      const [release] = stub.matching("UPDATE pets SET status = 'available'");
      assert.deepEqual(release.params, [7]);
      assert.equal(req.session.success, 'Solicitação rejeitada!');
    });

    test('rejecting a pending adoption leaves the pet untouched', async () => {
      stub.queueResults(
        { rows: [lockedAdoption()] },
        { rows: [] },
        { rows: [] },
        { rows: [] },
      );
      const req = createRequest({
        body: { status: 'rejected' },
        params: { id: '12' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await adoptionsController.updateStatus(req, res);

      assert.equal(stub.matching('UPDATE pets').length, 0);
      assert.equal(req.session.success, 'Solicitação rejeitada!');
    });

    test('moving an adoption to under review records the transition', async () => {
      stub.queueResults(
        { rows: [lockedAdoption()] },
        { rows: [] },
        { rows: [] },
        { rows: [] },
      );
      const req = createRequest({
        body: { status: 'under_review' },
        params: { id: '12' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await adoptionsController.updateStatus(req, res);

      const [history] = stub.matching('INSERT INTO adoption_status_history');
      assert.deepEqual(history.params, [12, 'pending', 'under_review', 1]);
      assert.equal(req.session.success, 'Solicitação em análise!');
    });

    test('reports a failure when the status transaction breaks', async () => {
      stub.failTransaction();
      const req = createRequest({
        body: { status: 'approved' },
        params: { id: '12' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await adoptionsController.updateStatus(req, res);

      assert.equal(req.session.error, 'Erro ao atualizar status.');
      assert.equal(res.redirectPath, '/admin/adoptions');
    });
  });

  describe('updateChecklist', () => {
    test('refuses an unknown checklist item', async () => {
      const req = createRequest({
        body: { item_key: 'unknown_step' },
        params: { id: '12' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await adoptionsController.updateChecklist(req, res);

      assert.equal(stub.calls.length, 0);
      assert.equal(req.session.error, 'Item de checklist inválido.');
      assert.equal(res.redirectPath, '/admin/adoptions/12');
    });

    test('marks a checklist item as completed', async () => {
      stub.queueResults({ rows: [] }, { rows: [] });
      const req = createRequest({
        body: { item_key: 'interview', completed: 'on', note: '  Entrevista feita  ' },
        params: { id: '12' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await adoptionsController.updateChecklist(req, res);

      const [upsert] = stub.matching('INSERT INTO adoption_checklists');
      assert.deepEqual(upsert.params, ['12', 'interview', true, 'Entrevista feita', 1]);
      const [audit] = stub.matching('INSERT INTO audit_logs');
      assert.deepEqual(audit.params, [1, '12', JSON.stringify({ item: 'interview', completed: true })]);
      assert.equal(req.session.success, 'Checklist atualizado.');
    });

    test('marks a checklist item as pending when the box is unchecked', async () => {
      stub.queueResults({ rows: [] }, { rows: [] });
      const req = createRequest({
        body: { item_key: 'contract' },
        params: { id: '12' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await adoptionsController.updateChecklist(req, res);

      const [upsert] = stub.matching('INSERT INTO adoption_checklists');
      assert.deepEqual(upsert.params, ['12', 'contract', false, null, 1]);
    });

    test('reports a failure when the checklist cannot be saved', async () => {
      stub.failNextQuery();
      const req = createRequest({
        body: { item_key: 'documents', completed: 'on' },
        params: { id: '12' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await adoptionsController.updateChecklist(req, res);

      assert.equal(req.session.error, 'Não foi possível atualizar o checklist.');
      assert.equal(res.redirectPath, '/admin/adoptions/12');
    });
  });

  describe('confirmDelivery', () => {
    test('requires the name of who confirmed the delivery', async () => {
      const req = createRequest({
        body: { signed_by: '   ' },
        params: { id: '12' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await adoptionsController.confirmDelivery(req, res);

      assert.equal(stub.calls.length, 0);
      assert.equal(req.session.error, 'Informe quem confirmou a entrega.');
      assert.equal(res.redirectPath, '/admin/adoptions/12');
    });

    test('reports a missing adoption on delivery confirmation', async () => {
      stub.queueResults({ rows: [] });
      const req = createRequest({
        body: { signed_by: 'Ana Silva' },
        params: { id: '404' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await adoptionsController.confirmDelivery(req, res);

      assert.equal(stub.matching('INSERT INTO adoption_deliveries').length, 0);
      assert.equal(req.session.error, 'Solicitação não encontrada.');
    });

    test('refuses the delivery when the adoption is not approved', async () => {
      stub.queueResults({ rows: [{ id: 12, pet_id: 7, status: 'pending', pet_status: 'reserved' }] });
      const req = createRequest({
        body: { signed_by: 'Ana Silva' },
        params: { id: '12' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await adoptionsController.confirmDelivery(req, res);

      assert.equal(stub.matching('INSERT INTO adoption_deliveries').length, 0);
      assert.equal(req.session.error, 'A adoção precisa estar aprovada e o pet reservado.');
    });

    test('refuses the delivery when the pet is not reserved', async () => {
      stub.queueResults({ rows: [{ id: 12, pet_id: 7, status: 'approved', pet_status: 'available' }] });
      const req = createRequest({
        body: { signed_by: 'Ana Silva' },
        params: { id: '12' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await adoptionsController.confirmDelivery(req, res);

      assert.equal(stub.matching('INSERT INTO adoption_deliveries').length, 0);
      assert.equal(req.session.error, 'A adoção precisa estar aprovada e o pet reservado.');
    });

    test('confirming the delivery completes the adoption and marks the pet adopted', async () => {
      stub.queueResults(
        { rows: [{ id: 12, pet_id: 7, status: 'approved', pet_status: 'reserved' }] },
        { rows: [] },
        { rows: [] },
        { rows: [] },
        { rows: [] },
        { rows: [] },
      );
      const req = createRequest({
        body: { signed_by: '  Ana Silva  ', document_reference: '  RG 12345  ', notes: '   ' },
        params: { id: '12' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await adoptionsController.confirmDelivery(req, res);

      const [delivery] = stub.matching('INSERT INTO adoption_deliveries');
      assert.deepEqual(delivery.params, [12, 'Ana Silva', 'RG 12345', null, 1]);
      const [complete] = stub.matching("UPDATE adoptions SET status = 'completed'");
      assert.deepEqual(complete.params, [12]);
      const [adopted] = stub.matching("UPDATE pets SET status = 'adopted'");
      assert.deepEqual(adopted.params, [7]);
      const [history] = stub.matching('INSERT INTO adoption_status_history');
      assert.deepEqual(history.params, [12, 1, 'Entrega confirmada']);
      assert.equal(req.session.success, 'Entrega do pet confirmada com sucesso.');
      assert.equal(res.redirectPath, '/admin/adoptions/12');
    });

    test('reports a failure when the delivery transaction breaks', async () => {
      stub.failTransaction();
      const req = createRequest({
        body: { signed_by: 'Ana Silva' },
        params: { id: '12' },
        session: { user: { id: 1 } },
      });
      const res = createResponse();

      await adoptionsController.confirmDelivery(req, res);

      assert.equal(req.session.error, 'Não foi possível confirmar a entrega.');
    });
  });

  describe('listing and details', () => {
    test('renders the adoption details with its history and checklist', async () => {
      stub.queueResults(
        { rows: [{ id: 12, pet_name: 'Thor' }] },
        { rows: [{ id: 1, new_status: 'pending' }] },
        { rows: [{ item_key: 'documents', completed: true }] },
      );
      const req = createRequest({ params: { id: '12' }, session: { user: { id: 1 } } });
      const res = createResponse();

      await adoptionsController.details(req, res);

      assert.equal(res.rendered.view, 'admin/adoption-detail');
      assert.deepEqual(res.rendered.data.adoption, { id: 12, pet_name: 'Thor' });
      assert.deepEqual(res.rendered.data.history, [{ id: 1, new_status: 'pending' }]);
      assert.deepEqual(res.rendered.data.checklist, [{ item_key: 'documents', completed: true }]);
    });

    test('renders the not found page for an unknown adoption', async () => {
      stub.queueResults({ rows: [] }, { rows: [] }, { rows: [] });
      const req = createRequest({ params: { id: '404' }, session: { user: { id: 1 } } });
      const res = createResponse();

      await adoptionsController.details(req, res);

      assert.equal(res.statusCode, 404);
      assert.equal(res.rendered.view, '404');
    });

    test('redirects to the adoption list when the details query fails', async () => {
      stub.failNextQuery();
      const req = createRequest({ params: { id: '12' }, session: { user: { id: 1 } } });
      const res = createResponse();

      await adoptionsController.details(req, res);

      assert.equal(req.session.error, 'Não foi possível carregar o acompanhamento da adoção.');
      assert.equal(res.redirectPath, '/admin/adoptions');
    });

    test('lists the adoptions for the admin screen', async () => {
      stub.queueResults({ rows: [{ id: 12, pet_name: 'Thor' }] });
      const req = createRequest({ session: { user: { id: 1 } } });
      const res = createResponse();

      await adoptionsController.adminList(req, res);

      assert.equal(res.rendered.view, 'admin/adoptions');
      assert.deepEqual(res.rendered.data.adoptions, [{ id: 12, pet_name: 'Thor' }]);
    });

    test('renders an empty adoption list when the query fails', async () => {
      stub.failNextQuery();
      const req = createRequest({ session: { user: { id: 1 } } });
      const res = createResponse();

      await adoptionsController.adminList(req, res);

      assert.equal(res.rendered.view, 'admin/adoptions');
      assert.deepEqual(res.rendered.data.adoptions, []);
    });

    test('renders the adoption success page', () => {
      const req = createRequest({ session: {} });
      const res = createResponse();

      adoptionsController.success(req, res);

      assert.equal(res.rendered.view, 'adoptions/success');
    });
  });
});
