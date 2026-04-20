const express = require('express');
const router = express.Router();
const adoptionsController = require('../controllers/adoptionsController');
const isAuthenticated = require('../middlewares/isAuthenticated');

// Rotas públicas
router.post('/adoptions', adoptionsController.create);
router.get('/adoptions/success', adoptionsController.success);

// Rotas admin (protegidas)
router.get('/admin/adoptions', isAuthenticated, adoptionsController.adminList);
router.post('/admin/adoptions/:id/status', isAuthenticated, adoptionsController.updateStatus);

module.exports = router;
