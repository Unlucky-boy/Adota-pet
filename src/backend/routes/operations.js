const express = require('express');
const operationsController = require('../controllers/operationsController');
const isAuthenticated = require('../middlewares/isAuthenticated');

const router = express.Router();

router.get('/admin/operations', isAuthenticated, operationsController.index);
router.post('/admin/operations/health', isAuthenticated, operationsController.createHealthRecord);
router.post('/admin/operations/vaccinations', isAuthenticated, operationsController.createVaccination);
router.post('/admin/operations/inventory', isAuthenticated, operationsController.createInventoryItem);
router.post('/admin/operations/foster-homes', isAuthenticated, operationsController.createFosterHome);
router.post('/admin/operations/foster-assignments', isAuthenticated, operationsController.createAssignment);
router.post('/admin/operations/shifts', isAuthenticated, operationsController.createShift);
router.post('/admin/operations/expenses', isAuthenticated, operationsController.createExpense);

module.exports = router;
