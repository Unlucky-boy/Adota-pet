const express = require('express');
const router = express.Router();
const volunteersController = require('../controllers/volunteersController');
const isAuthenticated = require('../middlewares/isAuthenticated');

// Rotas públicas (US14 — Cadastro de Voluntário)
router.get('/volunteer', volunteersController.formPage);
router.post('/volunteer', volunteersController.register);
router.get('/volunteer/success', volunteersController.successPage);

// Rotas admin (US16 — Aprovação de Voluntário)
router.get('/admin/volunteers', isAuthenticated, volunteersController.adminList);
router.post('/admin/volunteers/:id/status', isAuthenticated, volunteersController.updateStatus);

module.exports = router;
