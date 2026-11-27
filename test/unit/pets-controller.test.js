const assert = require('node:assert/strict');
const { describe, test, beforeEach, afterEach } = require('node:test');

const {
  createRequest, createResponse, captureConsoleError, stubDb,
} = require('../helpers/controller-harness');
const petsController = require('../../src/backend/controllers/petsController');

const INVALID_DATA = 'Dados do pet inválidos. Verifique os campos informados.';

function validPet(overrides = {}) {
  return {
    name: 'Thor',
    species: 'dog',
    breed: 'Vira-lata',
    age_months: '24',
    size: 'medium',
    gender: 'male',
    description: 'Dócil',
    image_url: 'https://example.com/thor.jpg',
    vaccinated: 'on',
    neutered: undefined,
    ...overrides,
  };
}

describe('pets controller', () => {
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

  describe('home', () => {
    test('renders featured pets with available and adopted counters', async () => {
      const pets = [{ id: 1, name: 'Thor' }];
      stub.queueResults({ rows: pets }, { rows: [{ count: '4' }] }, { rows: [{ count: '9' }] });
      const res = createResponse();

      await petsController.home(createRequest(), res);

      assert.equal(res.rendered.view, 'home');
      assert.deepEqual(res.rendered.data.pets, pets);
      assert.equal(res.rendered.data.availableCount, '4');
      assert.equal(res.rendered.data.adoptedCount, '9');
    });

    test('falls back to an empty home when the database fails', async () => {
      stub.failNextQuery();
      const res = createResponse();

      await petsController.home(createRequest(), res);

      assert.equal(res.rendered.view, 'home');
      assert.deepEqual(res.rendered.data.pets, []);
      assert.equal(res.rendered.data.availableCount, 0);
      assert.equal(res.rendered.data.adoptedCount, 0);
      assert.equal(consoleError.calls.length, 1);
    });
  });

  describe('list', () => {
    test('lists available pets without params when no filter is given', async () => {
      stub.queueResults({ rows: [{ id: 1 }] });
      const res = createResponse();

      await petsController.list(createRequest(), res);

      assert.deepEqual(stub.paramsOf(0), []);
      assert.equal(res.rendered.view, 'pets/list');
      assert.deepEqual(res.rendered.data.pets, [{ id: 1 }]);
    });

    test('passes every filter as a parameter, trimming the search term', async () => {
      const req = createRequest({
        query: { q: '  thor ', species: 'dog', size: 'large', gender: 'male' },
      });
      const res = createResponse();

      await petsController.list(req, res);

      assert.deepEqual(stub.paramsOf(0), ['%thor%', 'dog', 'large', 'male']);
      assert.deepEqual(res.rendered.data.filters, {
        q: '  thor ', species: 'dog', size: 'large', gender: 'male',
      });
    });

    test('ignores a blank search term', async () => {
      const res = createResponse();

      await petsController.list(createRequest({ query: { q: '   ', species: 'cat' } }), res);

      assert.deepEqual(stub.paramsOf(0), ['cat']);
    });

    test('renders an empty list when the database fails', async () => {
      stub.failNextQuery();
      const res = createResponse();

      await petsController.list(createRequest({ query: { species: 'dog' } }), res);

      assert.deepEqual(res.rendered.data.pets, []);
      assert.deepEqual(res.rendered.data.filters, {});
    });
  });

  describe('detail', () => {
    test('renders the pet page', async () => {
      stub.queueResults({ rows: [{ id: 7, name: 'Mel' }] });
      const res = createResponse();

      await petsController.detail(createRequest({ params: { id: '7' } }), res);

      assert.deepEqual(stub.paramsOf(0), ['7']);
      assert.equal(res.rendered.view, 'pets/detail');
      assert.equal(res.rendered.data.title, 'Mel — Adota Pet');
    });

    test('responds 404 when the pet does not exist', async () => {
      const res = createResponse();

      await petsController.detail(createRequest({ params: { id: '99' } }), res);

      assert.equal(res.statusCode, 404);
      assert.equal(res.rendered.view, '404');
    });

    test('responds 500 when the database fails', async () => {
      stub.failNextQuery();
      const res = createResponse();

      await petsController.detail(createRequest({ params: { id: '7' } }), res);

      assert.equal(res.statusCode, 500);
      assert.equal(res.rendered.view, '404');
    });
  });

  describe('adminList and newForm', () => {
    test('renders every pet in the admin dashboard', async () => {
      stub.queueResults({ rows: [{ id: 1 }, { id: 2 }] });
      const res = createResponse();

      await petsController.adminList(createRequest(), res);

      assert.equal(res.rendered.view, 'admin/pets');
      assert.equal(res.rendered.data.pets.length, 2);
    });

    test('renders an empty dashboard when the database fails', async () => {
      stub.failNextQuery();
      const res = createResponse();

      await petsController.adminList(createRequest(), res);

      assert.deepEqual(res.rendered.data.pets, []);
    });

    test('renders a blank creation form', () => {
      const res = createResponse();

      petsController.newForm(createRequest(), res);

      assert.equal(res.rendered.view, 'admin/pet-form');
      assert.equal(res.rendered.data.pet, null);
    });
  });

  describe('create', () => {
    test('inserts a valid pet, converting age and checkboxes', async () => {
      const req = createRequest({ body: validPet(), session: {} });
      const res = createResponse();

      await petsController.create(req, res);

      const [insert] = stub.matching('INSERT INTO pets');
      assert.deepEqual(insert.params, [
        'Thor', 'dog', 'Vira-lata', 24, 'medium', 'male', 'Dócil',
        'https://example.com/thor.jpg', true, false,
      ]);
      assert.equal(req.session.success, 'Pet "Thor" cadastrado com sucesso!');
      assert.equal(res.redirectPath, '/admin/pets');
    });

    test('stores a null age when none is informed', async () => {
      const req = createRequest({ body: validPet({ age_months: '' }), session: {} });

      await petsController.create(req, createResponse());

      assert.equal(stub.matching('INSERT INTO pets')[0].params[3], null);
    });

    const invalidCases = {
      'a blank name': { name: '   ' },
      'an unknown species': { species: 'bird' },
      'an unknown size': { size: 'giant' },
      'an unknown gender': { gender: 'other' },
      'a non-numeric age': { age_months: '2 anos' },
      'a negative age': { age_months: '-3' },
      'a non-http image url': { image_url: 'javascript:alert(1)' },
      'a malformed image url': { image_url: 'not a url' },
    };

    for (const [label, overrides] of Object.entries(invalidCases)) {
      test(`rejects ${label} before database access`, async () => {
        const req = createRequest({ body: validPet(overrides), session: {} });
        const res = createResponse();

        await petsController.create(req, res);

        assert.equal(stub.calls.length, 0);
        assert.equal(req.session.error, INVALID_DATA);
        assert.equal(res.redirectPath, '/admin/pets/new');
      });
    }

    test('accepts a pet without an image url', async () => {
      const req = createRequest({ body: validPet({ image_url: '' }), session: {} });

      await petsController.create(req, createResponse());

      assert.equal(stub.matching('INSERT INTO pets').length, 1);
    });

    test('returns to the form when the insert fails', async () => {
      stub.failNextQuery();
      const req = createRequest({ body: validPet(), session: {} });
      const res = createResponse();

      await petsController.create(req, res);

      assert.equal(req.session.error, 'Erro ao cadastrar pet. Tente novamente.');
      assert.equal(res.redirectPath, '/admin/pets/new');
    });
  });

  describe('editForm', () => {
    test('renders the form filled with the pet', async () => {
      stub.queueResults({ rows: [{ id: 3, name: 'Luna' }] });
      const res = createResponse();

      await petsController.editForm(createRequest({ params: { id: '3' } }), res);

      assert.equal(res.rendered.view, 'admin/pet-form');
      assert.equal(res.rendered.data.title, 'Editar Luna — Adota Pet');
      assert.deepEqual(res.rendered.data.pet, { id: 3, name: 'Luna' });
    });

    test('responds 404 for an invalid id before database access', async () => {
      const res = createResponse();

      await petsController.editForm(createRequest({ params: { id: 'abc' } }), res);

      assert.equal(stub.calls.length, 0);
      assert.equal(res.statusCode, 404);
    });

    test('responds 404 when the pet does not exist', async () => {
      const res = createResponse();

      await petsController.editForm(createRequest({ params: { id: '42' } }), res);

      assert.equal(res.statusCode, 404);
      assert.equal(res.rendered.view, '404');
    });

    test('redirects to the dashboard when the database fails', async () => {
      stub.failNextQuery();
      const res = createResponse();

      await petsController.editForm(createRequest({ params: { id: '3' } }), res);

      assert.equal(res.redirectPath, '/admin/pets');
    });
  });

  describe('update', () => {
    test('updates the pet including a new image url', async () => {
      const req = createRequest({
        params: { id: '5' },
        body: validPet({ status: 'reserved', neutered: 'on', vaccinated: undefined }),
        session: {},
      });
      const res = createResponse();

      await petsController.update(req, res);

      const [update] = stub.matching('UPDATE pets SET');
      assert.deepEqual(update.params, [
        'Thor', 'dog', 'Vira-lata', 24, 'medium', 'male', 'Dócil',
        false, true, 'reserved', '5', 'https://example.com/thor.jpg',
      ]);
      assert.ok(update.text.includes('image_url = $12'));
      assert.equal(req.session.success, 'Pet "Thor" atualizado!');
      assert.equal(res.redirectPath, '/admin/pets');
    });

    test('keeps the current image when no image url is sent', async () => {
      const req = createRequest({
        params: { id: '5' },
        body: validPet({ status: 'adopted', image_url: '' }),
        session: {},
      });

      await petsController.update(req, createResponse());

      const [update] = stub.matching('UPDATE pets SET');
      assert.equal(update.params.length, 11);
      assert.ok(!update.text.includes('image_url'));
    });

    test('rejects a missing or unknown status', async () => {
      for (const status of [undefined, 'lost']) {
        const req = createRequest({ params: { id: '5' }, body: validPet({ status }), session: {} });
        const res = createResponse();

        await petsController.update(req, res);

        assert.equal(req.session.error, INVALID_DATA);
        assert.equal(res.redirectPath, '/admin/pets/5/edit');
      }
      assert.equal(stub.calls.length, 0);
    });

    test('rejects an invalid id before database access', async () => {
      const req = createRequest({
        params: { id: '0' }, body: validPet({ status: 'available' }), session: {},
      });
      const res = createResponse();

      await petsController.update(req, res);

      assert.equal(stub.calls.length, 0);
      assert.equal(req.session.error, INVALID_DATA);
    });

    test('returns to the edit form when the update fails', async () => {
      stub.failNextQuery();
      const req = createRequest({
        params: { id: '5' }, body: validPet({ status: 'available' }), session: {},
      });
      const res = createResponse();

      await petsController.update(req, res);

      assert.equal(req.session.error, 'Erro ao atualizar pet.');
      assert.equal(res.redirectPath, '/admin/pets/5/edit');
    });
  });

  describe('delete', () => {
    test('removes the pet', async () => {
      const req = createRequest({ params: { id: '8' }, session: {} });
      const res = createResponse();

      await petsController.delete(req, res);

      assert.deepEqual(stub.matching('DELETE FROM pets')[0].params, ['8']);
      assert.equal(req.session.success, 'Pet removido com sucesso.');
      assert.equal(res.redirectPath, '/admin/pets');
    });

    test('rejects an invalid id before database access', async () => {
      const req = createRequest({ params: { id: '-1' }, session: {} });
      const res = createResponse();

      await petsController.delete(req, res);

      assert.equal(stub.calls.length, 0);
      assert.equal(req.session.error, 'Pet inválido.');
      assert.equal(res.redirectPath, '/admin/pets');
    });

    test('reports a database failure', async () => {
      stub.failNextQuery();
      const req = createRequest({ params: { id: '8' }, session: {} });
      const res = createResponse();

      await petsController.delete(req, res);

      assert.equal(req.session.error, 'Erro ao remover pet.');
      assert.equal(res.redirectPath, '/admin/pets');
    });
  });

  describe('getJson', () => {
    test('returns the pet as JSON', async () => {
      stub.queueResults({ rows: [{ id: 2, name: 'Bob' }] });
      const res = createResponse();

      await petsController.getJson(createRequest({ params: { id: '2' } }), res);

      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, { id: 2, name: 'Bob' });
    });

    test('responds 404 when the pet does not exist', async () => {
      const res = createResponse();

      await petsController.getJson(createRequest({ params: { id: '2' } }), res);

      assert.equal(res.statusCode, 404);
      assert.deepEqual(res.body, { error: 'Pet não encontrado' });
    });

    test('responds 500 when the database fails', async () => {
      stub.failNextQuery();
      const res = createResponse();

      await petsController.getJson(createRequest({ params: { id: '2' } }), res);

      assert.equal(res.statusCode, 500);
      assert.deepEqual(res.body, { error: 'Erro interno' });
    });
  });
});
