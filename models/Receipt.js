const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ReceiptSchema = new Schema({
  userId: {
    type: String,
    required: true,
  },
  vendor: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  cloudinaryUrl: {
    type: String,
  },
  rawItems: [
    {
      type: String,
      required: true,
    },
  ],
  totalAmount: {
    type: Number,
    required: true,
  },
  summaryEncrypted: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Receipt', ReceiptSchema);
