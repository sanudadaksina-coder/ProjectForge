const jwt = require('jsonwebtoken');

/**
 * Retrieves the JWT secret safely from the environment.
 * Throws an error if JWT_SECRET is missing.
 */
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is missing in server/.env');
  }
  return secret;
};

/**
 * Generates a signed JWT with a 24-hour expiration.
 * @param {Object} user - User document
 * @returns {string} Signed JWT token
 */
const generateToken = (user) => {
  const secret = getJwtSecret();
  return jwt.sign(
    {
      id: user._id,
      accountType: user.accountType
    },
    secret,
    { expiresIn: '24h' }
  );
};

/**
 * Attaches the HttpOnly session token cookie to the response.
 * @param {Object} res - Express response object
 * @param {string} token - Signed JWT
 */
const setTokenCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });
};

/**
 * Clears the session token cookie from the response.
 * @param {Object} res - Express response object
 */
const clearTokenCookie = (res) => {
  res.cookie('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0
  });
};

module.exports = {
  getJwtSecret,
  generateToken,
  setTokenCookie,
  clearTokenCookie
};
