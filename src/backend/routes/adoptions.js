const express = require('express');
const router = express.Router();
const adoptionsController = require('../controllers/adoptionsController');
const isAuthenticated = require('../middlewares/isAuthenticated');

// Rotas públicas
router.post('/adoptions', adoptionsController.create);
router.get('/adoptions/success', adoptionsController.success);

// Rotas admin (protegidas)
router.get('/admin/adoptions', isAuthenticated, adoptionsController.adminList);
router.get('/admin/adoptions/:id', isAuthenticated, adoptionsController.details);
router.post('/admin/adoptions/:id/status', isAuthenticated, adoptionsController.updateStatus);
router.post('/admin/adoptions/:id/checklist', isAuthenticated, adoptionsController.updateChecklist);
router.post('/admin/adoptions/:id/delivery', isAuthenticated, adoptionsController.confirmDelivery);

module.exports = router;
