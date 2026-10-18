const express = require('express');
const router = express.Router();
const adoptersController = require('../controllers/adoptersController');
const dashboardController = require('../controllers/dashboardController');
const isAdopterAuthenticated = require('../middlewares/isAdopterAuthenticated');

// Rotas públicas
router.get('/register', adoptersController.registerPage);
router.post('/register', adoptersController.register);
router.get('/register/success', adoptersController.successPage);

// Perfil do adotante/voluntario (US26)
router.get('/profile', isAdopterAuthenticated, dashboardController.index);

module.exports = router;
