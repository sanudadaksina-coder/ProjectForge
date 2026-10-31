const path = require('path');

// When running locally in test or preview mode, load environment variables from server/.env if needed
if (process.env.NODE_ENV !== 'production' || !process.env.MONGO_URI) {
  require('dotenv').config({ path: path.join(__dirname, '../server/.env') });
}

const app = require('../server/src/app');
const connectDB = require('../server/src/config/db');

/**
 * Vercel Serverless Function entry point for ProjectForge Express API.
 * Ensures MongoDB Atlas connection is cached/reused before delegating requests to Express.
 * Does not invoke app.listen(), allowing Vercel's serverless runtime to manage lifecycle.
 */
const handler = async (req, res) => {
  try {
    await connectDB();
  } catch (error) {
    const sanitizedError = (error.message || '').replace(/\/\/.*@/, '//****:****@');
    console.error(`[Vercel Serverless Handler] Database connection error: ${sanitizedError}`);

    // Allow application-level health check endpoint to respond even if database is connecting/unavailable
    if (req.url === '/api/health') {
      return app(req, res);
    }

    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: false,
      message: 'Database service temporarily unavailable',
      data: null,
      errors: [
        {
          message: 'Unable to connect to the database. Please try again shortly.'
        }
      ]
    }));
    return;
  }

  return app(req, res);
};

// Expose the underlying Express app for inspection and unit testing
handler.app = app;

module.exports = handler;
