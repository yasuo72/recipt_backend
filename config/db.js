const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      throw new Error('MONGO_URI environment variable is not set');
    }

    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('MongoDB connected for Receipt Store');
  } catch (err) {
    console.error('MongoDB connection error (Receipt Store):', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
