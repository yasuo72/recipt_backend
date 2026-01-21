const Receipt = require('../models/Receipt');
const { encrypt, decrypt } = require('../utils/encryption');
const { summarizeReceipt } = require('../services/geminiService');
const { extractTextFromCloudinaryUrl } = require('../services/ocrService');
const { uploadBufferToCloudinary } = require('../config/cloudinary');

// Normalize and validate incoming payload from Flutter / client
function normalizePayload(body) {
  const vendor = (body.vendor || '').trim();
  const dateRaw = (body.date || '').trim();
  const items = Array.isArray(body.items) ? body.items.map(String) : [];
  const totalRaw = String(body.total ?? '').trim();
  const userId = (body.userId || body.user_id || '').trim();

  if (!userId) throw new Error('userId (or user_id) is required');
  if (!vendor) throw new Error('vendor is required');
  if (!dateRaw) throw new Error('date is required');
  if (!items.length) throw new Error('items array is required');
  if (!totalRaw) throw new Error('total is required');

  // Parse date – fallback to now if parsing fails
  let date = new Date(dateRaw);
  if (Number.isNaN(date.getTime())) {
    date = new Date();
  }

  // Parse total number, stripping currency symbols
  const numeric = parseFloat(totalRaw.replace(/[^0-9.-]+/g, ''));
  const totalAmount = Number.isNaN(numeric) ? 0 : numeric;

  return {
    userId,
    vendor,
    date,
    items,
    totalAmount,
    totalRaw,
    dateRaw,
  };
}

// POST /api/receipts
// Accepts cleaned OCR JSON, calls Gemini, stores encrypted summary
exports.createReceipt = async (req, res) => {
  try {
    const payload = normalizePayload(req.body || {});

    const cloudinaryFileUrlRaw =
      (req.body.cloudinaryFileUrl || req.body.cloudinary_url || '').trim() || null;

    let ocrText = (req.body.ocrText || req.body.ocr_text || '').toString() || '';

    // If client did not provide OCR text, attempt to extract it from the
    // Cloudinary file (PDF/image) directly on the backend for best accuracy.
    if (!ocrText && cloudinaryFileUrlRaw) {
      try {
        ocrText = await extractTextFromCloudinaryUrl(cloudinaryFileUrlRaw);
      } catch (ocrError) {
        console.error('extractTextFromCloudinaryUrl failed:', ocrError);
      }
    }

    const contextForLLM = {
      cloudinaryFileUrl: cloudinaryFileUrlRaw,
      documentType:
        (req.body.documentType || req.body.document_type || '').trim() || null,
      ocrText,
      ocrJson: req.body.ocrJson || req.body.ocr_json || null,
      receipt: {
        vendor: payload.vendor,
        date: payload.dateRaw,
        items: payload.items,
        total: payload.totalRaw,
      },
    };

    let summary;
    try {
      summary = await summarizeReceipt(contextForLLM);
    } catch (llmError) {
      const errorPayload =
        llmError && llmError.response && llmError.response.data
          ? llmError.response.data
          : llmError;
      console.error('summarizeReceipt failed:', errorPayload);

      const message =
        errorPayload && errorPayload.error && errorPayload.error.message
          ? errorPayload.error.message
          : llmError && llmError.message
            ? llmError.message
            : 'AI service error';

      // Include the underlying AI error message in the fallback so we can
      // see from the client what went wrong during summarization.
      summary = `Summary temporarily unavailable: ${message}`;
    }

    const doc = new Receipt({
      userId: payload.userId,
      vendor: payload.vendor,
      date: payload.date,
      cloudinaryUrl: contextForLLM.cloudinaryFileUrl || undefined,
      rawItems: payload.items,
      totalAmount: payload.totalAmount,
      summaryEncrypted: encrypt(summary),
    });

    const saved = await doc.save();

    return res.status(201).json({
      success: true,
      receipt: {
        id: saved._id,
        userId: saved.userId,
        vendor: saved.vendor,
        date: saved.date,
        cloudinaryUrl: saved.cloudinaryUrl,
        rawItems: saved.rawItems,
        totalAmount: saved.totalAmount,
        createdAt: saved.createdAt,
      },
      summary,
    });
  } catch (err) {
    console.error('Error creating receipt:', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to create receipt',
    });
  }
};

// POST /api/receipts/upload
// Accepts an image/PDF file and uploads it to Cloudinary. Does NOT create a
// receipt record by itself; the client should subsequently call POST /api/receipts
// with the returned URL and OCR data.
exports.uploadFileToCloudinary = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please include a file field.',
      });
    }

    if (!req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'Uploaded file buffer is empty.',
      });
    }

    const result = await uploadBufferToCloudinary(
      req.file.buffer,
      req.file.originalname
    );

    return res.status(201).json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type,
    });
  } catch (err) {
    console.error('Cloudinary upload failed:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload file to Cloudinary',
    });
  }
};

// GET /api/receipts?userId=MED001
// Lists receipts for a user (without full summary text for performance & privacy)
exports.listReceipts = async (req, res) => {
  try {
    const userId = (req.query.userId || req.query.user_id || '').trim();
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId (or user_id) query parameter is required',
      });
    }

    const receipts = await Receipt.find({ userId }).sort({ createdAt: -1 });

    const payload = receipts.map((r) => ({
      id: r._id,
      vendor: r.vendor,
      date: r.date,
      cloudinaryUrl: r.cloudinaryUrl,
      totalAmount: r.totalAmount,
      createdAt: r.createdAt,
    }));

    return res.json({ success: true, receipts: payload });
  } catch (err) {
    console.error('Error listing receipts:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to list receipts',
    });
  }
};

// GET /api/receipts/:id
// Returns a single receipt with decrypted summary
exports.getReceipt = async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.id);
    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found',
      });
    }

    const summary = decrypt(receipt.summaryEncrypted);

    return res.json({
      success: true,
      receipt: {
        id: receipt._id,
        userId: receipt.userId,
        vendor: receipt.vendor,
        date: receipt.date,
        cloudinaryUrl: receipt.cloudinaryUrl,
        rawItems: receipt.rawItems,
        totalAmount: receipt.totalAmount,
        createdAt: receipt.createdAt,
      },
      summary,
    });
  } catch (err) {
    console.error('Error fetching receipt:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch receipt',
    });
  }
};

// DELETE /api/receipts/:id?userId=MED001
// Allows a user to delete a stored receipt. If userId is provided, it must
// match the stored userId on the document.
exports.deleteReceipt = async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.id);
    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found',
      });
    }

    const userId = (req.query.userId || req.query.user_id || '').trim();
    if (userId && userId !== receipt.userId) {
      return res.status(403).json({
        success: false,
        message: 'User not authorized to delete this receipt',
      });
    }

    await receipt.deleteOne();

    return res.json({
      success: true,
      message: 'Receipt deleted successfully',
    });
  } catch (err) {
    console.error('Error deleting receipt:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete receipt',
    });
  }
};
