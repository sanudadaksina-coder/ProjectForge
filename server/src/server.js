require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB Atlas BEFORE listening for HTTP requests
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`ProjectForge Server listening on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });

    return server;
  } catch (error) {
    const sanitizedError = (error.message || '').replace(/\/\/.*@/, '//****:****@');
    console.error(`Fatal server startup error: ${sanitizedError}`);
    process.exit(1);
  }
};

// Start the server
const serverPromise = startServer();

module.exports = { app, startServer, serverPromise };
