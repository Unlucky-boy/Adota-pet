const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const petsController = require('../controllers/petsController');
const isAuthenticated = require('../middlewares/isAuthenticated');

// Multer config para upload de imagens
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'frontend', 'public', 'uploads'),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    cb(null, extOk && mimeOk);
  },
});

// Rotas públicas
router.get('/', petsController.home);
router.get('/pets', petsController.list);
router.get('/pets/:id', petsController.detail);

// Rotas admin (protegidas)
router.get('/admin/pets', isAuthenticated, petsController.adminList);
router.get('/admin/pets/new', isAuthenticated, petsController.newForm);
router.post('/admin/pets', isAuthenticated, upload.single('image'), petsController.create);
router.get('/admin/pets/:id/edit', isAuthenticated, petsController.editForm);
router.post('/admin/pets/:id', isAuthenticated, upload.single('image'), petsController.update);
router.post('/admin/pets/:id/delete', isAuthenticated, petsController.delete);

// API JSON (para modais)
router.get('/api/pets/:id', isAuthenticated, petsController.getJson);

module.exports = router;
