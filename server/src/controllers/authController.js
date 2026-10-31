const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateToken, setTokenCookie, clearTokenCookie } = require('../utils/token');

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

/**
 * POST /api/auth/register
 * Student Registration only.
 * Prohibits supervisor registration or client-supplied elevated privileges.
 */
const register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      accountType,
      department,
      studentId,
      semester,
      skills
    } = req.body;

    // 1. Prohibit supervisor self-registration
    if (accountType === 'supervisor') {
      return res.status(403).json({
        success: false,
        message: 'Supervisor accounts cannot be publicly registered. Contact administration or run database seed.',
        data: null,
        errors: [
          {
            field: 'accountType',
            message: 'Public registration is strictly restricted to students.'
          }
        ]
      });
    }

    if (accountType && accountType !== 'student') {
      return res.status(422).json({
        success: false,
        message: 'Invalid account type specified.',
        data: null,
        errors: [
          {
            field: 'accountType',
            message: 'Public registration is only available for student accounts.'
          }
        ]
      });
    }

    // 2. Validate mandatory fields
    const missingFields = [];
    if (!name || !name.trim()) missingFields.push('name');
    if (!email || !email.trim()) missingFields.push('email');
    if (!password) missingFields.push('password');
    if (!department || !department.trim()) missingFields.push('department');

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing mandatory registration fields.',
        data: null,
        errors: missingFields.map(field => ({
          field,
          message: `${field} is required.`
        }))
      });
    }

    // 3. Validate input formats and lengths
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed.',
        data: null,
        errors: [
          {
            field: 'name',
            message: 'Name must be between 2 and 80 characters.'
          }
        ]
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed.',
        data: null,
        errors: [
          {
            field: 'email',
            message: 'Please provide a valid email address.'
          }
        ]
      });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed.',
        data: null,
        errors: [
          {
            field: 'password',
            message: 'Password must be at least 6 characters long.'
          }
        ]
      });
    }

    // 4. Validate semester if provided
    let parsedSemester = null;
    if (semester !== undefined && semester !== null && semester !== '') {
      const semNum = Number(semester);
      if (!Number.isInteger(semNum) || semNum < 1 || semNum > 8) {
        return res.status(422).json({
          success: false,
          message: 'Validation failed.',
          data: null,
          errors: [
            {
              field: 'semester',
              message: 'Semester must be an integer between 1 and 8.'
            }
          ]
        });
      }
      parsedSemester = semNum;
    }

    // 5. Hash password with bcrypt (10 rounds)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 6. Create student user
    const newUser = new User({
      name: trimmedName,
      email: normalizedEmail,
      passwordHash,
      accountType: 'student',
      department: department.trim(),
      studentId: studentId ? String(studentId).trim() : null,
      semester: parsedSemester,
      skills: Array.isArray(skills)
        ? skills.map(s => String(s).trim()).filter(Boolean)
        : []
    });

    await newUser.save();

    // 7. Issue JWT and set HttpOnly session cookie
    const token = generateToken(newUser);
    setTokenCookie(res, token);

    return res.status(201).json({
      success: true,
      message: 'Student account registered successfully',
      data: {
        user: newUser.toJSON()
      },
      errors: null
    });
  } catch (error) {
    // Duplicate email key error handling (MongoDB code 11000)
    if (error.code === 11000 || (error.keyPattern && error.keyPattern.email)) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
        data: null,
        errors: [
          {
            field: 'email',
            message: 'Email address is already in use.'
          }
        ]
      });
    }

    // Schema validation error
    if (error.name === 'ValidationError') {
      const validationErrors = Object.keys(error.errors).map(field => ({
        field,
        message: error.errors[field].message
      }));
      return res.status(422).json({
        success: false,
        message: 'Validation failed.',
        data: null,
        errors: validationErrors
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error during registration.',
      data: null,
      errors: [
        {
          message: error.message
        }
      ]
    });
  }
};

/**
 * POST /api/auth/login
 * Authenticates user credentials and issues HttpOnly session cookie.
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validate mandatory fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
        data: null,
        errors: [
          {
            message: 'Please provide both email and password.'
          }
        ]
      });
    }

    // 2. Validate email format
    const normalizedEmail = String(email).toLowerCase().trim();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(422).json({
        success: false,
        message: 'Invalid email format.',
        data: null,
        errors: [
          {
            field: 'email',
            message: 'Please provide a valid email address.'
          }
        ]
      });
    }

    // 3. Find user
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or incorrect password.',
        data: null,
        errors: [
          {
            message: 'Invalid credentials provided.'
          }
        ]
      });
    }

    // 4. Verify password with bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or incorrect password.',
        data: null,
        errors: [
          {
            message: 'Invalid credentials provided.'
          }
        ]
      });
    }

    // 5. Generate token and set HttpOnly cookie
    const token = generateToken(user);
    setTokenCookie(res, token);

    return res.status(200).json({
      success: true,
      message: 'Authentication successful',
      data: {
        user: user.toJSON()
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.',
      data: null,
      errors: [
        {
          message: error.message
        }
      ]
    });
  }
};

/**
 * POST /api/auth/logout
 * Clears HttpOnly session cookie.
 */
const logout = async (req, res) => {
  try {
    clearTokenCookie(res);
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
      data: null,
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error during logout.',
      data: null,
      errors: [
        {
          message: error.message
        }
      ]
    });
  }
};

/**
 * GET /api/auth/me
 * Retrieves the profile of the currently authenticated user.
 */
const getMe = async (req, res) => {
  try {
    const userJson = req.user.toJSON ? req.user.toJSON() : req.user;
    return res.status(200).json({
      success: true,
      message: 'Current user profile retrieved',
      data: {
        user: userJson
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error retrieving user profile.',
      data: null,
      errors: [
        {
          message: error.message
        }
      ]
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe
};
