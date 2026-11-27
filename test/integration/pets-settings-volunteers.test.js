const assert = require('node:assert/strict');
const { describe, test, before, beforeEach, after } = require('node:test');

const integrationDb = require('../helpers/integration-db');
const { anonymous, asAdmin } = require('../helpers/integration-agent');

const {
  skip, db, seedBaseline, resetDatabase, close, insertPet, rowsOf,
} = integrationDb;

const PET_FORM = {
  name: 'Thor',
  species: 'dog',
  breed: 'Labrador',
  age_months: '18',
  size: 'large',
  gender: 'male',
  description: 'Brincalhão',
  image_url: 'https://example.com/thor.jpg',
  vaccinated: 'on',
};

const VOLUNTEER_FORM = {
  name: 'Carla Souza',
  email: 'carla@example.com',
  phone: '(11) 98888-7777',
  availability: 'Fins de semana',
  motivation: 'Quero ajudar',
};

describe('pets, settings and volunteers', { skip }, () => {
  let adminAgent;
  let adminId;

  before(async () => {
    await resetDatabase();
    adminId = await seedBaseline();
    adminAgent = await asAdmin();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  after(async () => {
    await close();
  });

  describe('pets', () => {
    test('admin creates a pet that becomes publicly visible', async () => {
      await adminAgent.post('/admin/pets').type('form').send(PET_FORM)
        .expect(302)
        .expect('Location', '/admin/pets');

      const [pet] = await rowsOf('SELECT id, name, age_months, vaccinated, neutered, status FROM pets');
      assert.equal(pet.name, 'Thor');
      assert.equal(pet.age_months, 18);
      assert.equal(pet.vaccinated, true);
      assert.equal(pet.neutered, false);
      assert.equal(pet.status, 'available');

      const page = await anonymous().get(`/pets/${pet.id}`).expect(200);
      assert.match(page.text, /Thor/);
    });

    test('rejects invalid pet data without inserting', async () => {
      await adminAgent.post('/admin/pets').type('form').send({ ...PET_FORM, species: 'bird' })
        .expect(302)
        .expect('Location', '/admin/pets/new');

      assert.equal((await rowsOf('SELECT id FROM pets')).length, 0);
    });

    test('public listing shows only available pets and applies the filters', async () => {
      await insertPet({ name: 'Rex', species: 'dog', breed: 'Labrador' });
      await insertPet({ name: 'Mia', species: 'cat', breed: 'Siamês' });
      await insertPet({ name: 'Adotado', species: 'dog', status: 'adopted' });

      const all = await anonymous().get('/pets').expect(200);
      assert.match(all.text, /Rex/);
      assert.match(all.text, /Mia/);
      assert.doesNotMatch(all.text, /Adotado/);

      const cats = await anonymous().get('/pets').query({ species: 'cat' }).expect(200);
      assert.match(cats.text, /Mia/);
      assert.doesNotMatch(cats.text, /Rex/);

      const byBreed = await anonymous().get('/pets').query({ q: 'labra' }).expect(200);
      assert.match(byBreed.text, /Rex/);
      assert.doesNotMatch(byBreed.text, /Mia/);
    });

    test('updating without an image url keeps the stored image', async () => {
      const id = await insertPet({ name: 'Luna' });
      await db.query('UPDATE pets SET image_url = $1 WHERE id = $2', ['https://example.com/luna.jpg', id]);

      await adminAgent.post(`/admin/pets/${id}`).type('form')
        .send({ ...PET_FORM, name: 'Luna', image_url: '', status: 'reserved' })
        .expect(302)
        .expect('Location', '/admin/pets');

      const [pet] = await rowsOf('SELECT name, breed, status, image_url FROM pets WHERE id = $1', [id]);
      assert.equal(pet.breed, 'Labrador');
      assert.equal(pet.status, 'reserved');
      assert.equal(pet.image_url, 'https://example.com/luna.jpg');
    });

    test('admin deletes a pet and the API stops returning it', async () => {
      const id = await insertPet();
      const found = await adminAgent.get(`/api/pets/${id}`).expect(200);
      assert.equal(found.body.id, id);

      await adminAgent.post(`/admin/pets/${id}/delete`).expect(302);

      assert.equal((await rowsOf('SELECT id FROM pets')).length, 0);
      await adminAgent.get(`/api/pets/${id}`).expect(404);
      await anonymous().get(`/pets/${id}`).expect(404);
    });

    test('anonymous visitors cannot reach admin pet routes', async () => {
      await anonymous().post('/admin/pets').type('form').send(PET_FORM).expect(302);
      assert.equal((await rowsOf('SELECT id FROM pets')).length, 0);
    });
  });

  describe('settings', () => {
    after(async () => {
      await seedBaseline();
    });

    test('saving twice upserts a single row per key', async () => {
      await adminAgent.post('/admin/settings').type('form')
        .send({ pix_key: 'primeira-chave', project_email: 'a@ong.org' })
        .expect(302)
        .expect('Location', '/admin/settings');
      await adminAgent.post('/admin/settings').type('form')
        .send({ pix_key: '  segunda-chave  ', project_email: 'b@ong.org' })
        .expect(302);

      const rows = await rowsOf("SELECT key, value FROM settings WHERE key IN ('pix_key', 'project_email') ORDER BY key");
      assert.deepEqual(rows, [
        { key: 'pix_key', value: 'segunda-chave' },
        { key: 'project_email', value: 'b@ong.org' },
      ]);

      const page = await adminAgent.get('/admin/settings').expect(200);
      assert.match(page.text, /segunda-chave/);
    });

    test('an invalid e-mail leaves the stored settings untouched', async () => {
      await seedBaseline();

      await adminAgent.post('/admin/settings').type('form')
        .send({ pix_key: 'nova', project_email: 'invalido' })
        .expect(302);

      const [pix] = await rowsOf("SELECT value FROM settings WHERE key = 'pix_key'");
      assert.equal(pix.value, 'pix@lovepatinhas.org');
    });
  });

  describe('volunteers', () => {
    test('rejects a duplicate application regardless of e-mail casing', async () => {
      await anonymous().post('/volunteer').type('form').send(VOLUNTEER_FORM)
        .expect(302)
        .expect('Location', '/volunteer/success');
      await anonymous().post('/volunteer').type('form')
        .send({ ...VOLUNTEER_FORM, email: 'CARLA@Example.com' })
        .expect(302)
        .expect('Location', '/volunteer');

      const volunteers = await rowsOf('SELECT email, adopter_id, status FROM volunteers');
      assert.deepEqual(volunteers, [{ email: 'carla@example.com', adopter_id: null, status: 'pending' }]);
    });

    test('admin filters volunteers by status and the change is audited', async () => {
      await anonymous().post('/volunteer').type('form').send(VOLUNTEER_FORM).expect(302);
      await anonymous().post('/volunteer').type('form')
        .send({ ...VOLUNTEER_FORM, name: 'Davi Lima', email: 'davi@example.com' })
        .expect(302);
      const [carla] = await rowsOf("SELECT id FROM volunteers WHERE email = 'carla@example.com'");

      await adminAgent.post(`/admin/volunteers/${carla.id}/status`).type('form')
        .send({ status: 'rejected' })
        .expect(302);

      const [reviewed] = await rowsOf('SELECT status, reviewed_by FROM volunteers WHERE id = $1', [carla.id]);
      assert.equal(reviewed.status, 'rejected');
      assert.equal(reviewed.reviewed_by, adminId);

      const [audit] = await rowsOf(
        "SELECT entity_id, metadata FROM audit_logs WHERE action = 'volunteer_status_changed'",
      );
      assert.equal(Number(audit.entity_id), carla.id);
      assert.deepEqual(audit.metadata, { status: 'rejected' });

      const pending = await adminAgent.get('/admin/volunteers').query({ status: 'pending' }).expect(200);
      assert.match(pending.text, /Davi Lima/);
      assert.doesNotMatch(pending.text, /Carla Souza/);

      const rejected = await adminAgent.get('/admin/volunteers').query({ status: 'rejected' }).expect(200);
      assert.match(rejected.text, /Carla Souza/);
      assert.doesNotMatch(rejected.text, /Davi Lima/);
    });

    test('anonymous visitors cannot change a volunteer status', async () => {
      await anonymous().post('/volunteer').type('form').send(VOLUNTEER_FORM).expect(302);
      const [volunteer] = await rowsOf('SELECT id FROM volunteers');

      await anonymous().post(`/admin/volunteers/${volunteer.id}/status`).type('form')
        .send({ status: 'approved' })
        .expect(302);

      const [unchanged] = await rowsOf('SELECT status FROM volunteers');
      assert.equal(unchanged.status, 'pending');
    });
  });
});
