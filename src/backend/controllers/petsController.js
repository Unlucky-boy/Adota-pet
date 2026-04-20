const db = require('../config/db');

const petsController = {
  // GET / — Home com pets em destaque
  async home(req, res) {
    try {
      const result = await db.query(
        "SELECT * FROM pets WHERE status = 'available' ORDER BY created_at DESC LIMIT 6"
      );
      res.render('home', { title: 'Adota Pet — Encontre seu novo companheiro', pets: result.rows });
    } catch (err) {
      console.error('Erro ao carregar home:', err);
      res.render('home', { title: 'Adota Pet', pets: [] });
    }
  },

  // GET /pets — Listagem pública com filtros
  async list(req, res) {
    try {
      const { species, size, gender } = req.query;
      let query = "SELECT * FROM pets WHERE status = 'available'";
      const params = [];
      let paramIndex = 1;

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
        filters: { species, size, gender },
      });
    } catch (err) {
      console.error('Erro ao listar pets:', err);
      res.render('pets/list', { title: 'Pets disponíveis', pets: [], filters: {} });
    }
  },

  // GET /pets/:id — Detalhe do pet
  async detail(req, res) {
    try {
      const result = await db.query('SELECT * FROM pets WHERE id = $1', [req.params.id]);
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
      const result = await db.query('SELECT * FROM pets ORDER BY created_at DESC');
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
    const { name, species, breed, age_months, size, gender, description, vaccinated, neutered } = req.body;
    try {
      await db.query(
        `INSERT INTO pets (name, species, breed, age_months, size, gender, description, image_url, vaccinated, neutered)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          name, species, breed,
          age_months ? parseInt(age_months, 10) : null,
          size, gender, description,
          req.file ? `/uploads/${req.file.filename}` : '/img/pets/default.jpg',
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
    try {
      const result = await db.query('SELECT * FROM pets WHERE id = $1', [req.params.id]);
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
    const { name, species, breed, age_months, size, gender, description, vaccinated, neutered, status } = req.body;
    try {
      const imageUpdate = req.file ? ', image_url = $11' : '';
      const params = [
        name, species, breed,
        age_months ? parseInt(age_months, 10) : null,
        size, gender, description,
        vaccinated === 'on',
        neutered === 'on',
        status || 'available',
        req.params.id,
      ];

      if (req.file) {
        params.splice(10, 0, `/uploads/${req.file.filename}`);
      }

      await db.query(
        `UPDATE pets SET
          name = $1, species = $2, breed = $3, age_months = $4,
          size = $5, gender = $6, description = $7,
          vaccinated = $8, neutered = $9, status = $10
          ${imageUpdate}
         WHERE id = $${req.file ? 12 : 11}`,
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
      const result = await db.query('SELECT * FROM pets WHERE id = $1', [req.params.id]);
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
