const dns = require('dns');
const mongoose = require('mongoose');

// In local environments (outside Vercel production hosting), configure Node.js DNS resolution to use Google and Cloudflare DNS
if (!process.env.VERCEL && typeof dns.setServers === 'function') {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch {
    // Ignore if DNS server configuration is restricted in the execution environment
  }
}

// Global cache for connection reuse across serverless function invocations (warm lambdas)
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

/**
 * Connect to MongoDB Atlas using the MONGO_URI environment variable.
 * Implements connection caching and promise reuse for serverless environments (Vercel)
 * while preserving standard standalone Node.js server connections.
 * Sanitizes all output to ensure credentials and connection secrets are never logged.
 */
const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    const errorMsg = 'MongoDB connection error: MONGO_URI environment variable is not defined';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // 1. If connection is already established and active (readyState 1 = connected), return it immediately
  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose.connection;
    return mongoose.connection;
  }

  // 2. If cached connection object is already connected
  if (cached.conn && cached.conn.readyState === 1) {
    return cached.conn;
  }

  // 3. If a connection attempt is already in flight, await the existing promise (avoids race conditions)
  if (!cached.promise) {
    const opts = {
      authSource: 'admin',
      serverSelectionTimeoutMS: 5000 // Fast failover in serverless environments
    };

    cached.promise = mongoose.connect(uri, opts)
      .then((mongooseInstance) => {
        console.log(`MongoDB connected successfully [database: ${mongooseInstance.connection.name || 'projectforge_db'}]`);
        cached.conn = mongooseInstance.connection;
        return cached.conn;
      })
      .catch((error) => {
        // Reset cache so subsequent invocations can retry
        cached.promise = null;
        cached.conn = null;
        const sanitizedError = (error.message || '').replace(/\/\/.*@/, '//****:****@');
        console.error(`MongoDB connection error: ${sanitizedError}`);
        throw new Error(`MongoDB connection error: ${sanitizedError}`);
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    cached.conn = null;
    throw error;
  }
};

module.exports = connectDB;
