const assert = require('node:assert/strict');
const { describe, test, beforeEach, afterEach } = require('node:test');

const {
  createRequest, createResponse, captureConsoleError, stubDb,
} = require('../helpers/controller-harness');
const settingsController = require('../../src/backend/controllers/settingsController');

const SETTINGS_ROWS = {
  rows: [
    { key: 'pix_key', value: 'pix@ong.org' },
    { key: 'project_email', value: 'contato@ong.org' },
  ],
};

describe('settings controller', () => {
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

  describe('settingsPage', () => {
    test('renders the stored settings as a key/value object', async () => {
      stub.queueResults(SETTINGS_ROWS);
      const res = createResponse();

      await settingsController.settingsPage(createRequest(), res);

      assert.equal(res.rendered.view, 'admin/settings');
      assert.deepEqual(res.rendered.data.settings, {
        pix_key: 'pix@ong.org',
        project_email: 'contato@ong.org',
      });
    });

    test('renders blank settings when the database fails', async () => {
      stub.failNextQuery();
      const res = createResponse();

      await settingsController.settingsPage(createRequest(), res);

      assert.equal(res.rendered.view, 'admin/settings');
      assert.deepEqual(res.rendered.data.settings, { pix_key: '', project_email: '' });
      assert.equal(consoleError.calls.length, 1);
    });
  });

  describe('saveSettings', () => {
    test('upserts both settings with trimmed values', async () => {
      const req = createRequest({
        body: { pix_key: '  chave-pix  ', project_email: ' contato@ong.org ' },
        session: {},
      });
      const res = createResponse();

      await settingsController.saveSettings(req, res);

      const upserts = stub.matching('INSERT INTO settings');
      assert.equal(upserts.length, 2);
      assert.deepEqual(upserts.map((call) => call.params), [['chave-pix'], ['contato@ong.org']]);
      assert.equal(req.session.success, 'Configurações salvas com sucesso!');
      assert.equal(res.redirectPath, '/admin/settings');
    });

    test('stores empty strings when the fields are cleared', async () => {
      const req = createRequest({ body: {}, session: {} });

      await settingsController.saveSettings(req, createResponse());

      const upserts = stub.matching('INSERT INTO settings');
      assert.deepEqual(upserts.map((call) => call.params), [[''], ['']]);
      assert.equal(req.session.success, 'Configurações salvas com sucesso!');
    });

    test('rejects an invalid project e-mail before database access', async () => {
      const req = createRequest({ body: { pix_key: 'x', project_email: 'sem-arroba' }, session: {} });
      const res = createResponse();

      await settingsController.saveSettings(req, res);

      assert.equal(stub.calls.length, 0);
      assert.equal(req.session.error, 'E-mail do projeto inválido.');
      assert.equal(res.redirectPath, '/admin/settings');
    });

    test('reports a database failure', async () => {
      stub.failNextQuery();
      const req = createRequest({ body: { pix_key: 'x' }, session: {} });
      const res = createResponse();

      await settingsController.saveSettings(req, res);

      assert.equal(req.session.error, 'Erro ao salvar configurações.');
      assert.equal(req.session.success, undefined);
      assert.equal(res.redirectPath, '/admin/settings');
    });
  });

  describe('getAll', () => {
    test('returns the settings as a key/value object', async () => {
      stub.queueResults(SETTINGS_ROWS);

      const settings = await settingsController.getAll();

      assert.deepEqual(settings, { pix_key: 'pix@ong.org', project_email: 'contato@ong.org' });
    });

    test('propagates database failures to the caller', async () => {
      stub.failNextQuery(new Error('offline'));

      await assert.rejects(settingsController.getAll(), /offline/);
    });
  });
});
