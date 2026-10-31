const dns = require('dns');
const mongoose = require('mongoose');

/**
 * Connect to MongoDB Atlas using the MONGO_URI environment variable.
 * Sanitizes all output to ensure credentials and connection secrets are never logged.
 */
const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('MongoDB connection error: MONGO_URI environment variable is not defined in server/.env');
    process.exit(1);
  }

  // In local development only, configure Node.js DNS resolution to use Google and Cloudflare DNS
  if (process.env.NODE_ENV !== 'production') {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }

  try {
    const conn = await mongoose.connect(uri, {
      authSource: 'admin'
    });
    console.log(`MongoDB connected successfully [database: ${conn.connection.name || 'projectforge_db'}]`);
    return conn;
  } catch (error) {
    // Sanitize any potential URI/credentials leakage from error messages
    const sanitizedError = (error.message || '').replace(/\/\/.*@/, '//****:****@');
    console.error(`MongoDB connection error: ${sanitizedError}`);
    process.exit(1);
  }
};

module.exports = connectDB;
