const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const isAuthenticated = require('../middlewares/isAuthenticated');

router.get('/admin/dashboard', isAuthenticated, dashboardController.adminAnalytics);
router.get('/admin/reports/donations.csv', isAuthenticated, dashboardController.donationsReport);
router.get('/admin/reports/adoptions.csv', isAuthenticated, dashboardController.adoptionsReport);
router.get('/admin/reports/financial.csv', isAuthenticated, dashboardController.financialReport);
router.get('/', dashboardController.index);

module.exports = router;
