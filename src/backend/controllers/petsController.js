const db = require('../config/db');
const { isValidHttpUrl, isValidId } = require('../utils/validation');

const validSpecies = ['dog', 'cat', 'other'];
const validSizes = ['small', 'medium', 'large'];
const validGenders = ['male', 'female'];
const validStatuses = ['available', 'reserved', 'adopted'];

function validatePetData(data, updating = false) {
  if (!data.name?.trim() || !validSpecies.includes(data.species)
    || !validSizes.includes(data.size) || !validGenders.includes(data.gender)) return false;
  if (data.age_months !== '' && data.age_months !== undefined && !/^\d+$/.test(String(data.age_months))) return false;
  if (!isValidHttpUrl(data.image_url)) return false;
  return !updating || validStatuses.includes(data.status);
}

const petsController = {
  // GET / — Home com pets em destaque
  async home(req, res) {
    try {
      const result = await db.query(
        "SELECT id, name, species, breed, age_months, size, gender, description, image_url, vaccinated, neutered, status, created_at FROM pets WHERE status = 'available' ORDER BY created_at DESC LIMIT 6"
      );
      
      const availablePetsResult = await db.query("SELECT COUNT(*) FROM pets WHERE status = 'available'");
      const adoptedPetsResult = await db.query("SELECT COUNT(*) FROM pets WHERE status = 'adopted'");
      
      const availableCount = availablePetsResult.rows[0].count;
      const adoptedCount = adoptedPetsResult.rows[0].count;

      res.render('home', { 
        title: 'Adota Pet — Encontre seu novo companheiro', 
        pets: result.rows,
        availableCount,
        adoptedCount
      });
    } catch (err) {
      console.error('Erro ao carregar home:', err);
      res.render('home', { title: 'Adota Pet', pets: [], availableCount: 0, adoptedCount: 0 });
    }
  },

  // GET /pets — Listagem pública com filtros
  async list(req, res) {
    try {
      const { q, species, size, gender } = req.query;
      let query = "SELECT id, name, species, breed, age_months, size, gender, description, image_url, vaccinated, neutered, status, created_at FROM pets WHERE status = 'available'";
      const params = [];
      let paramIndex = 1;

      if (q && q.trim()) {
        query += ` AND (name ILIKE $${paramIndex} OR breed ILIKE $${paramIndex})`;
        params.push(`%${q.trim()}%`);
        paramIndex += 1;
      }

      if (species) {
        query += ` AND species = $${paramIndex++}`;
        params.push(species);
      }
      if (size) {
        query += ` AND size = $${paramIndex++}`;
        params.push(size);
      }
      if (gender) {
        query += ` AND gender = $${paramIndex++}`;
        params.push(gender);
      }

      query += ' ORDER BY created_at DESC';

      const result = await db.query(query, params);
      res.render('pets/list', {
        title: 'Pets disponíveis — Adota Pet',
        pets: result.rows,
        filters: { q, species, size, gender },
      });
    } catch (err) {
      console.error('Erro ao listar pets:', err);
      res.render('pets/list', { title: 'Pets disponíveis', pets: [], filters: {} });
    }
  },

  // GET /pets/:id — Detalhe do pet
  async detail(req, res) {
    try {
      const result = await db.query('SELECT id, name, species, breed, age_months, size, gender, description, image_url, vaccinated, neutered, status, created_at FROM pets WHERE id = $1', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).render('404', { title: 'Pet não encontrado' });
      }
      res.render('pets/detail', {
        title: `${result.rows[0].name} — Adota Pet`,
        pet: result.rows[0],
      });
    } catch (err) {
      console.error('Erro ao carregar pet:', err);
      res.status(500).render('404', { title: 'Erro' });
    }
  },

  // GET /admin/pets — Dashboard (ONG)
  async adminList(req, res) {
    try {
      const result = await db.query('SELECT id, name, species, breed, age_months, size, gender, description, image_url, vaccinated, neutered, status, created_at FROM pets ORDER BY created_at DESC');
      res.render('admin/pets', { title: 'Gerenciar Pets — Adota Pet', pets: result.rows });
    } catch (err) {
      console.error('Erro ao listar pets (admin):', err);
      res.render('admin/pets', { title: 'Gerenciar Pets', pets: [] });
    }
  },

  // GET /admin/pets/new — Formulário de cadastro
  newForm(req, res) {
    res.render('admin/pet-form', { title: 'Cadastrar Pet — Adota Pet', pet: null });
  },

  // POST /admin/pets — Criar pet
  async create(req, res) {
    const { name, species, breed, age_months, size, gender, description, image_url, vaccinated, neutered } = req.body;
    if (!validatePetData(req.body)) {
      req.session.error = 'Dados do pet inválidos. Verifique os campos informados.';
      return res.redirect('/admin/pets/new');
    }
    try {
      await db.query(
        `INSERT INTO pets (name, species, breed, age_months, size, gender, description, image_url, vaccinated, neutered)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          name, species, breed,
          age_months ? parseInt(age_months, 10) : null,
          size, gender, description,
          image_url,
          vaccinated === 'on',
          neutered === 'on',
        ]
      );
      req.session.success = `Pet "${name}" cadastrado com sucesso!`;
      res.redirect('/admin/pets');
    } catch (err) {
      console.error('Erro ao criar pet:', err);
      req.session.error = 'Erro ao cadastrar pet. Tente novamente.';
      res.redirect('/admin/pets/new');
    }
  },

  // GET /admin/pets/:id/edit — Formulário de edição
  async editForm(req, res) {
    if (!isValidId(req.params.id)) return res.status(404).render('404', { title: 'Pet não encontrado' });
    try {
      const result = await db.query('SELECT id, name, species, breed, age_months, size, gender, description, image_url, vaccinated, neutered, status, created_at FROM pets WHERE id = $1', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).render('404', { title: 'Pet não encontrado' });
      }
      res.render('admin/pet-form', {
        title: `Editar ${result.rows[0].name} — Adota Pet`,
        pet: result.rows[0],
      });
    } catch (err) {
      console.error('Erro ao carregar formulário de edição:', err);
      res.redirect('/admin/pets');
    }
  },

  // POST /admin/pets/:id — Atualizar pet
  async update(req, res) {
    const { name, species, breed, age_months, size, gender, description, image_url, vaccinated, neutered, status } = req.body;
    if (!isValidId(req.params.id) || !validatePetData(req.body, true)) {
      req.session.error = 'Dados do pet inválidos. Verifique os campos informados.';
      return res.redirect(`/admin/pets/${req.params.id}/edit`);
    }
    try {
      let imageUpdate = '';
      const params = [
        name, species, breed,
        age_months ? parseInt(age_months, 10) : null,
        size, gender, description,
        vaccinated === 'on',
        neutered === 'on',
        status || 'available',
        req.params.id,
      ];

      if (image_url) {
        imageUpdate = ', image_url = $12';
        params.push(image_url);
      }

      await db.query(
        `UPDATE pets SET
          name = $1, species = $2, breed = $3, age_months = $4,
          size = $5, gender = $6, description = $7,
          vaccinated = $8, neutered = $9, status = $10
          ${imageUpdate}
         WHERE id = $11`,
        params
      );

      req.session.success = `Pet "${name}" atualizado!`;
      res.redirect('/admin/pets');
    } catch (err) {
      console.error('Erro ao atualizar pet:', err);
      req.session.error = 'Erro ao atualizar pet.';
      res.redirect(`/admin/pets/${req.params.id}/edit`);
    }
  },

  // POST /admin/pets/:id/delete — Remover pet
  async delete(req, res) {
    if (!isValidId(req.params.id)) {
      req.session.error = 'Pet inválido.';
      return res.redirect('/admin/pets');
    }
    try {
      await db.query('DELETE FROM pets WHERE id = $1', [req.params.id]);
      req.session.success = 'Pet removido com sucesso.';
      res.redirect('/admin/pets');
    } catch (err) {
      console.error('Erro ao remover pet:', err);
      req.session.error = 'Erro ao remover pet.';
      res.redirect('/admin/pets');
    }
  },


  // GET /api/pets/:id — Retorna JSON de um pet (para modal de edição)
  async getJson(req, res) {
    try {
      const result = await db.query('SELECT id, name, species, breed, age_months, size, gender, description, image_url, vaccinated, neutered, status, created_at FROM pets WHERE id = $1', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Pet não encontrado' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Erro ao buscar pet (JSON):', err);
      res.status(500).json({ error: 'Erro interno' });
    }
  },
};

module.exports = petsController;
