const express = require('express');
const router = express.Router();
const visitsController = require('../controllers/visitsController');
const isAuthenticated = require('../middlewares/isAuthenticated');

// Todas as rotas protegidas (somente ONG agenda visitas)
router.get('/admin/visits', isAuthenticated, visitsController.list);
router.get('/admin/visits/new', isAuthenticated, visitsController.newForm);
router.post('/admin/visits', isAuthenticated, visitsController.create);
router.post('/admin/visits/:id/status', isAuthenticated, visitsController.updateStatus);

module.exports = router;
