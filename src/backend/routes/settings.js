const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const isAuthenticated = require('../middlewares/isAuthenticated');

router.get('/admin/settings', isAuthenticated, settingsController.settingsPage);
router.post('/admin/settings', isAuthenticated, settingsController.saveSettings);

module.exports = router;
