const assert = require('node:assert/strict');
const { describe, test, before, beforeEach, after } = require('node:test');

const integrationDb = require('../helpers/integration-db');
const { anonymous, asAdmin } = require('../helpers/integration-agent');

const {
  skip, resetDatabase, seedBaseline, close, insertPet, rowsOf,
} = integrationDb;

const ADOPTER = {
  name: 'Marina Funcional',
  cpf: '529.982.247-25',
  phone: '(82) 99888-7766',
  email: 'marina.funcional@example.com',
  address: 'Rua dos Testes, 31',
  password: 'perfil123',
};
const RECEIPT = Buffer.from('comprovante-funcional');

async function registerAndLogin() {
  const agent = anonymous();
  await agent
    .post('/register')
    .type('form')
    .send({
      name: ADOPTER.name,
      cpf: ADOPTER.cpf,
      phone: ADOPTER.phone,
      email: ADOPTER.email,
      address: ADOPTER.address,
      password: ADOPTER.password,
      password_confirm: ADOPTER.password,
    })
    .expect(302)
    .expect('Location', '/register/success');

  await agent
    .post('/login')
    .type('form')
    .send({ email: ADOPTER.email, password: ADOPTER.password })
    .expect(302)
    .expect('Location', '/dashboard');

  return agent;
}

async function requestAdoption(adopterAgent, petId) {
  await adopterAgent
    .post('/adoptions')
    .type('form')
    .send({ pet_id: String(petId), message: 'Solicitação do roteiro funcional.' })
    .expect(302)
    .expect('Location', '/adoptions/success');

  const [adoption] = await rowsOf(
    'SELECT id, adopter_id, status FROM adoptions WHERE pet_id = $1',
    [petId],
  );
  return adoption;
}

describe('US31 — testes funcionais dos fluxos principais', { skip }, () => {
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

  test('login — autentica a ONG e protege credenciais inválidas', async () => {
    const invalid = await anonymous()
      .post('/login')
      .type('form')
      .send({ email: 'admin@teste.com', password: 'senha-incorreta' })
      .expect(302);
    assert.equal(invalid.headers.location, '/login');

    const ong = await asAdmin();
    await ong.get('/admin/pets').expect(200);
  });

  test('cadastro de adotante — cria conta utilizável e impede CPF duplicado', async () => {
    const adopterAgent = await registerAndLogin();
    const [adopter] = await rowsOf(
      'SELECT name, cpf, email, password_hash FROM adopters WHERE email = $1',
      [ADOPTER.email],
    );
    assert.equal(adopter.name, ADOPTER.name);
    assert.equal(adopter.cpf, ADOPTER.cpf);
    assert.notEqual(adopter.password_hash, ADOPTER.password);
    await adopterAgent.get('/profile').expect(200);

    const duplicate = await anonymous()
      .post('/register')
      .type('form')
      .send({
        name: ADOPTER.name,
        cpf: ADOPTER.cpf,
        phone: ADOPTER.phone,
        email: 'outro@example.com',
        address: ADOPTER.address,
        password: ADOPTER.password,
        password_confirm: ADOPTER.password,
      })
      .expect(302);
    assert.equal(duplicate.headers.location, '/register');
    assert.equal((await rowsOf('SELECT id FROM adopters')).length, 1);
  });

  test('adoção — registra a solicitação e permite aprovação administrativa', async () => {
    const adopterAgent = await registerAndLogin();
    const petId = await insertPet({ name: 'Nina Funcional' });
    const adoption = await requestAdoption(adopterAgent, petId);
    assert.ok(adoption.adopter_id);
    assert.equal(adoption.status, 'pending');

    await adminAgent
      .post(`/admin/adoptions/${adoption.id}/status`)
      .type('form')
      .send({ status: 'approved' })
      .expect(302)
      .expect('Location', '/admin/adoptions');

    const [approved] = await rowsOf('SELECT status FROM adoptions WHERE id = $1', [adoption.id]);
    const [pet] = await rowsOf('SELECT status FROM pets WHERE id = $1', [petId]);
    assert.equal(approved.status, 'approved');
    assert.equal(pet.status, 'reserved');
    assert.equal((await rowsOf(
      "SELECT id FROM audit_logs WHERE action = 'adoption_status_changed' AND entity_id = $1",
      [adoption.id],
    )).length, 1);
  });

  test('doação — registra PIX, recebe comprovante e confirma pela ONG', async () => {
    const adopterAgent = await registerAndLogin();
    const created = await adopterAgent
      .post('/donate')
      .type('form')
      .send({ amount: '80.50', payment_method: 'pix' })
      .expect(302);
    const receiptCode = created.headers.location.replace('/donate/receipt/', '');

    await adopterAgent
      .post(`/donate/receipt/${receiptCode}/upload`)
      .attach('receipt_image', RECEIPT, { filename: 'comprovante.png', contentType: 'image/png' })
      .expect(302);
    const [pendingReview] = await rowsOf(
      'SELECT id, adopter_id, status FROM donations WHERE receipt_code = $1',
      [receiptCode],
    );
    assert.ok(pendingReview.adopter_id);
    assert.equal(pendingReview.status, 'pending_review');

    await adminAgent
      .post(`/admin/donations/${pendingReview.id}/status`)
      .type('form')
      .send({ status: 'completed' })
      .expect(302);
    const [completed] = await rowsOf('SELECT status FROM donations WHERE id = $1', [pendingReview.id]);
    assert.equal(completed.status, 'completed');
  });

  test('voluntariado — envia inscrição vinculada ao perfil e aprova pela ONG', async () => {
    const adopterAgent = await registerAndLogin();
    await adopterAgent
      .post('/volunteer')
      .type('form')
      .send({
        name: 'Nome adulterado',
        email: 'outro@example.com',
        phone: ADOPTER.phone,
        availability: 'Sábados pela manhã',
        motivation: 'Quero ajudar no acolhimento.',
      })
      .expect(302)
      .expect('Location', '/volunteer/success');

    const [volunteer] = await rowsOf('SELECT id, adopter_id, name, email, status FROM volunteers');
    assert.ok(volunteer.adopter_id);
    assert.equal(volunteer.name, ADOPTER.name);
    assert.equal(volunteer.email, ADOPTER.email);
    assert.equal(volunteer.status, 'pending');

    await adminAgent
      .post(`/admin/volunteers/${volunteer.id}/status`)
      .type('form')
      .send({ status: 'approved' })
      .expect(302);
    const [approved] = await rowsOf('SELECT status, reviewed_by, reviewed_at FROM volunteers');
    assert.equal(approved.status, 'approved');
    assert.ok(approved.reviewed_by);
    assert.ok(approved.reviewed_at);
  });

  test('agendamento de visita — agenda entrevista futura para uma adoção aprovada', async () => {
    const adopterAgent = await registerAndLogin();
    const petId = await insertPet({ name: 'Bento Funcional' });
    const adoption = await requestAdoption(adopterAgent, petId);
    await adminAgent
      .post(`/admin/adoptions/${adoption.id}/status`)
      .type('form')
      .send({ status: 'approved' })
      .expect(302);

    await adminAgent
      .post('/admin/visits')
      .type('form')
      .send({
        adoption_id: String(adoption.id),
        visit_date: '2099-12-20',
        visit_time: '14:30',
        visit_type: 'interview',
        notes: 'Entrevista do roteiro funcional.',
      })
      .expect(302)
      .expect('Location', '/admin/visits');

    const [visit] = await rowsOf(
      'SELECT adoption_id, visit_date::text, visit_time::text, visit_type, status FROM visits',
    );
    assert.equal(visit.adoption_id, adoption.id);
    assert.equal(visit.visit_date, '2099-12-20');
    assert.match(visit.visit_time, /^14:30/);
    assert.equal(visit.visit_type, 'interview');
    assert.equal(visit.status, 'scheduled');
    const listing = await adminAgent.get('/admin/visits').expect(200);
    assert.match(listing.text, /Bento Funcional/);
  });

  test('perfil — apresenta dados e históricos vinculados ao próprio adotante', async () => {
    const adopterAgent = await registerAndLogin();
    const petId = await insertPet({ name: 'Lola no Perfil' });
    const adoption = await requestAdoption(adopterAgent, petId);
    await adminAgent
      .post('/admin/visits')
      .type('form')
      .send({
        adoption_id: String(adoption.id),
        visit_date: '2099-11-15',
        visit_time: '10:00',
        visit_type: 'home_visit',
      })
      .expect(302);
    const donationResponse = await adopterAgent
      .post('/donate')
      .type('form')
      .send({ amount: '35', payment_method: 'pix' })
      .expect(302);
    const receiptCode = donationResponse.headers.location.replace('/donate/receipt/', '');
    await adopterAgent
      .post('/volunteer')
      .type('form')
      .send({
        phone: ADOPTER.phone,
        availability: 'Domingos',
        motivation: 'Apoio nos eventos.',
      })
      .expect(302);

    const profile = await adopterAgent.get('/profile').expect(200);
    assert.match(profile.text, /Marina Funcional/);
    assert.match(profile.text, /marina\.funcional@example\.com/);
    assert.match(profile.text, /Rua dos Testes, 31/);
    assert.match(profile.text, /Lola no Perfil/);
    assert.match(profile.text, new RegExp(receiptCode));
    assert.match(profile.text, /Domingos/);
    assert.match(profile.text, /15\/11\/2099/);
  });
});
