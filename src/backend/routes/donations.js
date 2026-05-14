const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const donationsController = require('../controllers/donationsController');
const isAuthenticated = require('../middlewares/isAuthenticated');

// Multer config para upload de comprovantes
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'frontend', 'public', 'uploads'),
  filename: (req, file, cb) => {
    const uniqueName = `receipt-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|pdf/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    cb(null, extOk && mimeOk);
  },
});

// Rotas públicas
router.get('/donate', donationsController.donatePage);
router.post('/donate', upload.single('receipt_image'), donationsController.donate);
router.get('/donate/receipt/:code', donationsController.receiptPage);
router.post('/donate/receipt/:code/upload', upload.single('receipt_image'), donationsController.uploadReceipt);

// Rotas admin
router.get('/admin/donations', isAuthenticated, donationsController.adminList);
router.post('/admin/donations/:id/status', isAuthenticated, donationsController.updateStatus);

module.exports = router;
