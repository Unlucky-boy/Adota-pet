const assert = require('node:assert/strict');
const { describe, test, before, beforeEach, after } = require('node:test');

const integrationDb = require('../helpers/integration-db');
const { anonymous, asAdmin } = require('../helpers/integration-agent');

const {
  skip, db, ADMIN, seedBaseline, resetDatabase, close,
  insertPet, insertAdoption, insertDonation, rowsOf,
} = integrationDb;

const PERIOD = { start: '2025-01-01', end: '2025-01-31' };

function normalizeHtml(value) {
  return String(value).replace(/<[^>]+>/g, '').replace(/&nbsp;|\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function kpiValue(html, label) {
  const labelPosition = html.indexOf(`<span>${label}</span>`);
  assert.notEqual(labelPosition, -1, `KPI não encontrado: ${label}`);
  const card = html.slice(labelPosition, html.indexOf('</article>', labelPosition));
  const match = card.match(/<strong>([\s\S]*?)<\/strong>/);
  assert.ok(match, `Valor do KPI não encontrado: ${label}`);
  return normalizeHtml(match[1]);
}

async function seedAnalyticsPeriod() {
  const includedPetId = await insertPet({ name: 'Pet Janeiro US30' });
  const excludedPetId = await insertPet({ name: 'Pet Fevereiro US30' });
  await db.query("UPDATE pets SET created_at = '2025-01-05 10:00:00' WHERE id = $1", [includedPetId]);
  await db.query("UPDATE pets SET created_at = '2025-02-05 10:00:00' WHERE id = $1", [excludedPetId]);

  const approvedId = await insertAdoption(includedPetId, { status: 'approved', adopter_name: 'Dentro do período' });
  const pendingId = await insertAdoption(includedPetId, { status: 'pending', adopter_name: 'Pendente no período' });
  const excludedAdoptionId = await insertAdoption(excludedPetId, { status: 'approved', adopter_name: 'Fora do período' });
  await db.query("UPDATE adoptions SET created_at = '2025-01-10 09:00:00' WHERE id IN ($1, $2)", [approvedId, pendingId]);
  await db.query("UPDATE adoptions SET created_at = '2025-02-10 09:00:00' WHERE id = $1", [excludedAdoptionId]);

  await db.query(
    `INSERT INTO visits (adoption_id, visit_date, visit_time, status)
     VALUES ($1, '2025-01-15', '10:00', 'scheduled'),
            ($2, '2025-01-16', '11:00', 'completed'),
            ($3, '2025-02-16', '12:00', 'scheduled')`,
    [approvedId, pendingId, excludedAdoptionId],
  );

  const completedDonationId = await insertDonation({
    amount: '150.00', status: 'completed', receipt_code: 'US30-IN-DONE', donor_name: 'Dentro do período',
  });
  const pendingDonationId = await insertDonation({
    amount: '80.00', status: 'pending_review', receipt_code: 'US30-IN-WAIT', donor_name: 'Pendente no período',
  });
  const excludedDonationId = await insertDonation({
    amount: '999.00', status: 'completed', receipt_code: 'US30-OUT', donor_name: 'Fora do período',
  });
  await db.query("UPDATE donations SET created_at = '2025-01-20 14:00:00' WHERE id IN ($1, $2)", [completedDonationId, pendingDonationId]);
  await db.query("UPDATE donations SET created_at = '2025-02-20 14:00:00' WHERE id = $1", [excludedDonationId]);

  return { includedPetId, approvedId, pendingId };
}

describe('US30 - validação interna do dashboard e auditoria', { skip }, () => {
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

  test('confere métricas filtradas do dashboard contra consultas diretas ao banco', async () => {
    await seedAnalyticsPeriod();

    const [adoptions, visits, donations] = await Promise.all([
      rowsOf(
        `SELECT COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
                COUNT(*) FILTER (WHERE status IN ('approved', 'completed'))::int AS approved
         FROM adoptions WHERE created_at >= $1::date AND created_at < $2::date + INTERVAL '1 day'`,
        [PERIOD.start, PERIOD.end],
      ),
      rowsOf(
        `SELECT COUNT(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
                COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
         FROM visits WHERE visit_date >= $1::date AND visit_date < $2::date + INTERVAL '1 day'`,
        [PERIOD.start, PERIOD.end],
      ),
      rowsOf(
        `SELECT COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0)::numeric AS confirmed,
                COUNT(*) FILTER (WHERE status IN ('pending_payment', 'pending_review'))::int AS pending
         FROM donations WHERE created_at >= $1::date AND created_at < $2::date + INTERVAL '1 day'`,
        [PERIOD.start, PERIOD.end],
      ),
    ]);

    const response = await adminAgent
      .get(`/admin/dashboard?start_date=${PERIOD.start}&end_date=${PERIOD.end}`)
      .expect(200);

    assert.equal(kpiValue(response.text, 'Adoções aprovadas'), String(adoptions[0].approved));
    assert.match(response.text, new RegExp(`${adoptions[0].pending} aguardando análise`));
    assert.equal(kpiValue(response.text, 'Visitas agendadas'), String(visits[0].scheduled));
    assert.match(response.text, new RegExp(`${visits[0].completed} visitas concluídas`));
    assert.equal(kpiValue(response.text, 'Doações confirmadas'), 'R$ 150,00');
    assert.equal(donations[0].confirmed, '150.00');
    assert.match(response.text, new RegExp(`${donations[0].pending} aguardando confirmação`));
    assert.doesNotMatch(response.text, /Fora do período/);

    const invalid = await adminAgent
      .get('/admin/dashboard?start_date=2025-02-01&end_date=2025-01-01')
      .expect(200);
    assert.match(invalid.text, /Informe datas válidas/);
  });

  test('valida filtros e conteúdo dos três relatórios CSV', async () => {
    await seedAnalyticsPeriod();
    await db.query(
      `INSERT INTO expenses (category, description, amount, expense_date)
       VALUES ('Validação', 'Despesa dentro do período', 25.50, '2025-01-22'),
              ('Validação', 'Despesa fora do período', 700, '2025-02-22')`,
    );
    const query = `start_date=${PERIOD.start}&end_date=${PERIOD.end}`;

    const adoptionsCsv = await adminAgent.get(`/admin/reports/adoptions.csv?${query}`).expect(200);
    assert.match(adoptionsCsv.headers['content-type'], /text\/csv/);
    assert.match(adoptionsCsv.headers['content-disposition'], /relatorio-adocoes\.csv/);
    assert.match(adoptionsCsv.text, /Dentro do período/);
    assert.doesNotMatch(adoptionsCsv.text, /Fora do período/);

    const donationsCsv = await adminAgent.get(`/admin/reports/donations.csv?${query}`).expect(200);
    assert.match(donationsCsv.text, /US30-IN-DONE/);
    assert.match(donationsCsv.text, /US30-IN-WAIT/);
    assert.doesNotMatch(donationsCsv.text, /US30-OUT/);

    const financialCsv = await adminAgent.get(`/admin/reports/financial.csv?${query}`).expect(200);
    assert.match(financialCsv.text, /2025-01/);
    assert.match(financialCsv.text, /150\.00/);
    assert.match(financialCsv.text, /25\.50/);
    assert.doesNotMatch(financialCsv.text, /700\.00/);

    for (const path of [
      '/admin/reports/adoptions.csv',
      '/admin/reports/donations.csv',
      '/admin/reports/financial.csv',
    ]) {
      const denied = await anonymous().get(path).expect(302);
      assert.equal(denied.headers.location, '/login');
    }
  });

  test('executa todos os cadastros operacionais e valida listagens e trilha de auditoria', async () => {
    const adminId = (await rowsOf('SELECT id FROM users WHERE email = $1', [ADMIN.email]))[0].id;
    const petId = await insertPet({ name: 'Pet Auditoria US30' });
    const adoptionId = await insertAdoption(petId, { adopter_name: 'Adotante Auditoria' });
    const volunteerResult = await db.query(
      `INSERT INTO volunteers (name, email, phone, availability, status)
       VALUES ('Voluntário US30', 'voluntario-us30@example.com', '11999999999', 'Sábados', 'approved')
       RETURNING id`,
    );
    const volunteerId = volunteerResult.rows[0].id;

    await adminAgent.post('/admin/operations/health').type('form').send({
      pet_id: petId, record_type: 'Consulta US30', record_date: '2025-01-10',
      provider: 'Clínica US30', description: 'Avaliação interna', cost: '89.90',
    }).expect(302).expect('Location', '/admin/operations');

    await adminAgent.post('/admin/operations/vaccinations').type('form').send({
      pet_id: petId, vaccine_name: 'V10 US30', administered_at: '2025-01-11',
      next_due_at: '2026-01-11', notes: 'Dose de validação',
    }).expect(302);

    await adminAgent.post('/admin/operations/inventory').type('form').send({
      name: 'Ração US30', category: 'alimentação', quantity: '20', unit: 'kg', minimum_quantity: '5',
    }).expect(302);

    await adminAgent.post('/admin/operations/foster-homes').type('form').send({
      name: 'Lar US30', email: 'lar-us30@example.com', phone: '11988887777',
      address: 'Rua de Validação, 30', capacity: '2', notes: 'Lar do roteiro interno',
    }).expect(302);
    const fosterHomeId = (await rowsOf("SELECT id FROM foster_homes WHERE name = 'Lar US30'"))[0].id;

    await adminAgent.post('/admin/operations/foster-assignments').type('form').send({
      pet_id: petId, foster_home_id: fosterHomeId, start_date: '2025-01-12', notes: 'Acolhimento US30',
    }).expect(302);

    await adminAgent.post('/admin/operations/shifts').type('form').send({
      volunteer_id: volunteerId, shift_date: '2025-01-18', start_time: '08:00',
      end_time: '12:00', notes: 'Turno US30',
    }).expect(302);

    await adminAgent.post('/admin/operations/expenses').type('form').send({
      category: 'Veterinária', description: 'Despesa US30', amount: '25.50',
      expense_date: '2025-01-20', vendor: 'Fornecedor US30',
    }).expect(302);

    await adminAgent.post('/admin/visits').type('form').send({
      adoption_id: adoptionId, visit_date: '2099-01-15', visit_time: '14:30',
      visit_type: 'interview', notes: 'Entrevista US30',
    }).expect(302).expect('Location', '/admin/visits');
    const visitId = (await rowsOf('SELECT id FROM visits WHERE adoption_id = $1', [adoptionId]))[0].id;
    await adminAgent.post(`/admin/visits/${visitId}/status`).type('form')
      .send({ status: 'completed' }).expect(302);

    const tableChecks = [
      ['pet_health_records', 'record_type', 'Consulta US30'],
      ['pet_vaccinations', 'vaccine_name', 'V10 US30'],
      ['inventory_items', 'name', 'Ração US30'],
      ['foster_homes', 'name', 'Lar US30'],
      ['foster_assignments', 'notes', 'Acolhimento US30'],
      ['volunteer_shifts', 'notes', 'Turno US30'],
      ['expenses', 'description', 'Despesa US30'],
    ];
    for (const [table, column, expected] of tableChecks) {
      const result = await rowsOf(`SELECT ${column} AS value FROM ${table}`);
      assert.equal(result.length, 1, `${table} deve conter o cadastro da validação`);
      assert.equal(result[0].value, expected);
    }

    const logs = await rowsOf(
      `SELECT a.action, a.user_id, a.created_at, a.metadata, u.name AS user_name
       FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id`,
    );
    const expectedActions = [
      'health_record_created', 'vaccination_created', 'inventory_item_created',
      'foster_home_created', 'foster_assignment_created', 'volunteer_shift_created',
      'expense_created', 'visit_created', 'visit_status_changed',
    ];
    assert.deepEqual(logs.map((log) => log.action), expectedActions);
    logs.forEach((log) => {
      assert.equal(log.user_id, adminId);
      assert.equal(log.user_name, ADMIN.name);
      assert.ok(log.created_at);
      assert.ok(Object.keys(log.metadata).length >= 2, `${log.action} deve descrever a alteração`);
    });

    const operationsPage = await adminAgent.get('/admin/operations').expect(200);
    for (const visibleValue of [
      'Consulta US30', 'V10 US30', 'Ração US30', 'Lar US30', 'Pet Auditoria US30',
      'Voluntário US30', 'Despesa US30', 'Auditoria administrativa', 'Alteração', ADMIN.name,
    ]) {
      assert.match(operationsPage.text, new RegExp(visibleValue));
    }
    assert.match(operationsPage.text, /Visita agendada/);
    assert.match(operationsPage.text, /Status de visita alterado/);
    assert.match(operationsPage.text, /Anterior:<\/b> Agendado/);
    assert.match(operationsPage.text, /Novo:<\/b> Concluído/);
  });
});
