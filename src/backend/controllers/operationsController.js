const db = require('../config/db');

async function audit(req, action, entityType, entityId, metadata = {}) {
  await db.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [req.session.user.id, action, entityType, entityId || null, JSON.stringify(metadata)]
  );
}

function redirectWithMessage(req, res, path, message, error = false) {
  req.session[error ? 'error' : 'success'] = message;
  return res.redirect(path);
}

function validId(value) {
  return /^\d+$/.test(String(value || '')) && Number(value) > 0;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function validTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
}

function validAmount(value, allowZero = true) {
  if (value === '' || value === null || value === undefined) return false;
  const amount = Number(value);
  return Number.isFinite(amount) && (allowZero ? amount >= 0 : amount > 0);
}

function validEmail(value) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const operationsController = {
  async index(req, res) {
    try {
      const [pets, health, vaccinations, inventory, fosterHomes, assignments, volunteers, shifts, expenses, auditLogs] = await Promise.all([
        db.query('SELECT id, name FROM pets ORDER BY name'),
        db.query(`SELECT h.*, p.name AS pet_name FROM pet_health_records h JOIN pets p ON p.id = h.pet_id ORDER BY h.record_date DESC LIMIT 20`),
        db.query(`SELECT v.*, p.name AS pet_name FROM pet_vaccinations v JOIN pets p ON p.id = v.pet_id ORDER BY v.next_due_at NULLS LAST, v.administered_at DESC LIMIT 20`),
        db.query('SELECT * FROM inventory_items ORDER BY name'),
        db.query("SELECT * FROM foster_homes WHERE status = 'active' ORDER BY name"),
        db.query(`SELECT f.*, p.name AS pet_name, h.name AS foster_name FROM foster_assignments f JOIN pets p ON p.id = f.pet_id JOIN foster_homes h ON h.id = f.foster_home_id WHERE f.status = 'active' ORDER BY f.start_date DESC`),
        db.query("SELECT id, name FROM volunteers WHERE status = 'approved' ORDER BY name"),
        db.query(`SELECT s.*, v.name AS volunteer_name FROM volunteer_shifts s LEFT JOIN volunteers v ON v.id = s.volunteer_id ORDER BY s.shift_date DESC, s.start_time DESC LIMIT 20`),
        db.query('SELECT * FROM expenses ORDER BY expense_date DESC, id DESC LIMIT 30'),
        db.query(`
          SELECT a.*, u.name AS user_name, pet.name AS pet_name
          FROM audit_logs a
          LEFT JOIN users u ON u.id = a.user_id
          LEFT JOIN LATERAL (
            SELECT p.name
            FROM pets p
            WHERE (a.entity_type IN ('pet_health_record', 'pet_vaccination', 'foster_assignment')
                   AND p.id = NULLIF(a.metadata->>'petId', '')::INTEGER)
               OR (a.entity_type = 'adoption'
                   AND p.id = (SELECT pet_id FROM adoptions WHERE id = a.entity_id))
            LIMIT 1
          ) pet ON TRUE
          ORDER BY a.created_at DESC LIMIT 30`),
      ]);

      return res.render('admin/operations', {
        title: 'Operação da ONG — Adota Pet',
        pets: pets.rows,
        healthRecords: health.rows,
        vaccinations: vaccinations.rows,
        inventory: inventory.rows,
        fosterHomes: fosterHomes.rows,
        assignments: assignments.rows,
        volunteers: volunteers.rows,
        shifts: shifts.rows,
        expenses: expenses.rows,
        auditLogs: auditLogs.rows,
      });
    } catch (err) {
      console.error('Erro ao carregar operação da ONG:', err);
      return res.render('admin/operations', {
        title: 'Operação da ONG', pets: [], healthRecords: [], vaccinations: [], inventory: [],
        fosterHomes: [], assignments: [], volunteers: [], shifts: [], expenses: [], auditLogs: [],
      });
    }
  },

  async createHealthRecord(req, res) {
    const { pet_id, record_type, record_date, provider, description, cost } = req.body;
    if (!validId(pet_id) || !record_type?.trim() || !description?.trim()) return redirectWithMessage(req, res, '/admin/operations', 'Pet, tipo e descrição válidos são obrigatórios.', true);
    if ((record_date && !validDate(record_date)) || (cost !== '' && cost !== undefined && !validAmount(cost))) return redirectWithMessage(req, res, '/admin/operations', 'Data ou custo do registro veterinário inválido.', true);
    try {
      const result = await db.query(
        `INSERT INTO pet_health_records (pet_id, record_type, record_date, provider, description, cost, created_by)
         VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5, COALESCE($6, 0), $7) RETURNING id`,
        [pet_id, record_type.trim(), record_date || null, provider?.trim() || null, description.trim(), cost || null, req.session.user.id]
      );
      await audit(req, 'health_record_created', 'pet_health_record', result.rows[0].id, { petId: pet_id });
      return redirectWithMessage(req, res, '/admin/operations', 'Registro veterinário adicionado.');
    } catch (err) {
      console.error('Erro ao criar registro veterinário:', err);
      return redirectWithMessage(req, res, '/admin/operations', 'Não foi possível salvar o registro veterinário.', true);
    }
  },

  async createVaccination(req, res) {
    const { pet_id, vaccine_name, administered_at, next_due_at, notes } = req.body;
    if (!validId(pet_id) || !vaccine_name?.trim() || !validDate(administered_at)) return redirectWithMessage(req, res, '/admin/operations', 'Pet, vacina e data válidos são obrigatórios.', true);
    if (next_due_at && (!validDate(next_due_at) || next_due_at < administered_at)) return redirectWithMessage(req, res, '/admin/operations', 'A próxima dose deve ter uma data válida posterior à aplicação.', true);
    try {
      const result = await db.query(
        `INSERT INTO pet_vaccinations (pet_id, vaccine_name, administered_at, next_due_at, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [pet_id, vaccine_name.trim(), administered_at, next_due_at || null, notes?.trim() || null, req.session.user.id]
      );
      await audit(req, 'vaccination_created', 'pet_vaccination', result.rows[0].id, { petId: pet_id });
      return redirectWithMessage(req, res, '/admin/operations', 'Vacinação registrada.');
    } catch (err) {
      console.error('Erro ao criar vacinação:', err);
      return redirectWithMessage(req, res, '/admin/operations', 'Não foi possível salvar a vacinação.', true);
    }
  },

  async createInventoryItem(req, res) {
    const { name, category, quantity, unit, minimum_quantity } = req.body;
    if (!name?.trim() || !category?.trim() || !unit?.trim()) return redirectWithMessage(req, res, '/admin/operations', 'Nome, categoria e unidade são obrigatórios.', true);
    const normalizedQuantity = quantity === '' || quantity === undefined ? 0 : quantity;
    const normalizedMinimum = minimum_quantity === '' || minimum_quantity === undefined ? 0 : minimum_quantity;
    if (!validAmount(normalizedQuantity) || !validAmount(normalizedMinimum)) return redirectWithMessage(req, res, '/admin/operations', 'Quantidade ou estoque mínimo inválido.', true);
    try {
      const result = await db.query(
        `INSERT INTO inventory_items (name, category, quantity, unit, minimum_quantity, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [name.trim(), category.trim(), normalizedQuantity, unit.trim(), normalizedMinimum, req.session.user.id]
      );
      await audit(req, 'inventory_item_created', 'inventory_item', result.rows[0].id, { name: name.trim() });
      return redirectWithMessage(req, res, '/admin/operations', 'Item de estoque adicionado.');
    } catch (err) {
      console.error('Erro ao criar item de estoque:', err);
      return redirectWithMessage(req, res, '/admin/operations', 'Não foi possível salvar o item de estoque.', true);
    }
  },

  async createFosterHome(req, res) {
    const { name, email, phone, address, capacity, notes } = req.body;
    if (!name?.trim()) return redirectWithMessage(req, res, '/admin/operations', 'Nome do lar temporário é obrigatório.', true);
    if (!validEmail(email)) return redirectWithMessage(req, res, '/admin/operations', 'E-mail do lar temporário inválido.', true);
    if (!/^\d+$/.test(String(capacity || '')) || Number(capacity) < 1) return redirectWithMessage(req, res, '/admin/operations', 'A capacidade deve ser um número inteiro maior que zero.', true);
    try {
      const result = await db.query(
        `INSERT INTO foster_homes (name, email, phone, address, capacity, notes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [name.trim(), email?.trim() || null, phone?.trim() || null, address?.trim() || null, capacity || 1, notes?.trim() || null]
      );
      await audit(req, 'foster_home_created', 'foster_home', result.rows[0].id, { name: name.trim() });
      return redirectWithMessage(req, res, '/admin/operations', 'Lar temporário cadastrado.');
    } catch (err) {
      console.error('Erro ao criar lar temporário:', err);
      return redirectWithMessage(req, res, '/admin/operations', 'Não foi possível salvar o lar temporário.', true);
    }
  },

  async createAssignment(req, res) {
    const { pet_id, foster_home_id, start_date, end_date, notes } = req.body;
    if (!validId(pet_id) || !validId(foster_home_id) || !validDate(start_date)) return redirectWithMessage(req, res, '/admin/operations', 'Pet, lar e data inicial válidos são obrigatórios.', true);
    if (end_date && (!validDate(end_date) || end_date < start_date)) return redirectWithMessage(req, res, '/admin/operations', 'A data final deve ser válida e posterior ao início.', true);
    try {
      const capacityResult = await db.query(
        `SELECT h.capacity, COUNT(f.id)::int AS active_assignments
         FROM foster_homes h
         LEFT JOIN foster_assignments f ON f.foster_home_id = h.id AND f.status = 'active'
         WHERE h.id = $1
         GROUP BY h.id`,
        [foster_home_id]
      );
      if (capacityResult.rows.length === 0) return redirectWithMessage(req, res, '/admin/operations', 'Lar temporário não encontrado.', true);
      if (capacityResult.rows[0].active_assignments >= capacityResult.rows[0].capacity) {
        return redirectWithMessage(req, res, '/admin/operations', 'A capacidade deste lar temporário já foi atingida.', true);
      }

      const result = await db.query(
        `INSERT INTO foster_assignments (pet_id, foster_home_id, start_date, end_date, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [pet_id, foster_home_id, start_date, end_date || null, notes?.trim() || null, req.session.user.id]
      );
      await audit(req, 'foster_assignment_created', 'foster_assignment', result.rows[0].id, { petId: pet_id, fosterHomeId: foster_home_id });
      return redirectWithMessage(req, res, '/admin/operations', 'Lar temporário atribuído ao pet.');
    } catch (err) {
      console.error('Erro ao criar acolhimento:', err);
      return redirectWithMessage(req, res, '/admin/operations', 'Não foi possível salvar o acolhimento.', true);
    }
  },

  async createShift(req, res) {
    const { volunteer_id, shift_date, start_time, end_time, notes } = req.body;
    if ((volunteer_id && !validId(volunteer_id)) || !validDate(shift_date) || !validTime(start_time) || !validTime(end_time)) return redirectWithMessage(req, res, '/admin/operations', 'Data e horários do turno são obrigatórios.', true);
    if (end_time <= start_time) return redirectWithMessage(req, res, '/admin/operations', 'O horário final deve ser posterior ao horário inicial.', true);
    try {
      const result = await db.query(
        `INSERT INTO volunteer_shifts (volunteer_id, shift_date, start_time, end_time, notes, assigned_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [volunteer_id || null, shift_date, start_time, end_time, notes?.trim() || null, req.session.user.id]
      );
      await audit(req, 'volunteer_shift_created', 'volunteer_shift', result.rows[0].id, { volunteerId: volunteer_id || null });
      return redirectWithMessage(req, res, '/admin/operations', 'Turno agendado.');
    } catch (err) {
      console.error('Erro ao criar turno:', err);
      return redirectWithMessage(req, res, '/admin/operations', 'Não foi possível salvar o turno.', true);
    }
  },

  async createExpense(req, res) {
    const { category, description, amount, expense_date, vendor } = req.body;
    if (!category?.trim() || !description?.trim() || !validAmount(amount, false) || (expense_date && !validDate(expense_date))) return redirectWithMessage(req, res, '/admin/operations', 'Categoria, descrição e valor válido são obrigatórios.', true);
    try {
      const result = await db.query(
        `INSERT INTO expenses (category, description, amount, expense_date, vendor, created_by)
         VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5, $6) RETURNING id`,
        [category.trim(), description.trim(), amount, expense_date || null, vendor?.trim() || null, req.session.user.id]
      );
      await audit(req, 'expense_created', 'expense', result.rows[0].id, { amount });
      return redirectWithMessage(req, res, '/admin/operations', 'Despesa registrada.');
    } catch (err) {
      console.error('Erro ao criar despesa:', err);
      return redirectWithMessage(req, res, '/admin/operations', 'Não foi possível salvar a despesa.', true);
    }
  },
};

module.exports = operationsController;
