const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const isAuthenticated = require('../middlewares/isAuthenticated');

router.get('/admin/dashboard', isAuthenticated, dashboardController.adminAnalytics);
router.get('/', dashboardController.index);

module.exports = router;
