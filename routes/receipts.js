const express = require('express');
const router = express.Router();
const receiptController = require('../controllers/receiptController');
const upload = require('../middleware/upload');

// Create a new receipt from cleaned OCR JSON + Gemini summary
router.post('/', receiptController.createReceipt);

// Upload a raw image/PDF file to Cloudinary and return its URL
router.post(
  '/upload',
  upload.single('file'),
  receiptController.uploadFileToCloudinary
);

// List receipts for a user (by userId/user_id query param)
router.get('/', receiptController.listReceipts);

// Fetch a single receipt + decrypted summary
router.get('/:id', receiptController.getReceipt);

// Delete a stored receipt
router.delete('/:id', receiptController.deleteReceipt);

module.exports = router;
