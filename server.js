require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Routes
app.use('/api/receipts', require('./routes/receipts'));

// Basic health check
app.get('/', (_req, res) => {
  res.json({ ok: true, message: 'MedAssist Receipt Store API is running' });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Receipt Store service listening on port ${PORT}`);
});
