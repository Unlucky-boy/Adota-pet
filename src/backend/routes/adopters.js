const express = require('express');
const router = express.Router();
const adoptersController = require('../controllers/adoptersController');

// Rotas públicas
router.get('/register', adoptersController.registerPage);
router.post('/register', adoptersController.register);
router.get('/register/success', adoptersController.successPage);

module.exports = router;
