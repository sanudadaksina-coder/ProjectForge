const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name cannot exceed 80 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required']
    },
    accountType: {
      type: String,
      required: [true, 'Account type is required'],
      enum: {
        values: ['student', 'supervisor'],
        message: 'Account type must be either student or supervisor'
      }
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true
    },
    // Student-only optional fields
    studentId: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator: function(val) {
          if (!val) return true;
          return this.accountType === 'student';
        },
        message: 'Student ID can only be set for student accounts'
      }
    },
    semester: {
      type: Number,
      default: null,
      validate: {
        validator: function(val) {
          if (val === null || val === undefined) return true;
          return this.accountType === 'student' && Number.isInteger(val) && val >= 1 && val <= 8;
        },
        message: 'Semester is student-only and must be an integer between 1 and 8'
      }
    },
    skills: {
      type: [String],
      default: []
    },
    // Supervisor-only optional fields
    contactEmail: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator: function(val) {
          if (!val) return true;
          return /^\S+@\S+\.\S+$/.test(val);
        },
        message: 'Please provide a valid contact email address'
      }
    },
    designation: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator: function(val) {
          if (!val) return true;
          return this.accountType === 'supervisor';
        },
        message: 'Designation can only be specified for supervisor accounts'
      }
    },
    researchInterests: {
      type: [String],
      default: [],
      validate: {
        validator: function(val) {
          if (!val || val.length === 0) return true;
          return this.accountType === 'supervisor';
        },
        message: 'Research interests can only be specified for supervisor accounts'
      }
    },
    officeLocation: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator: function(val) {
          if (!val) return true;
          return this.accountType === 'supervisor';
        },
        message: 'Office location can only be specified for supervisor accounts'
      }
    },
    maxCapacity: {
      type: Number,
      default: function() {
        return this.accountType === 'supervisor' ? 5 : null;
      },
      validate: {
        validator: function(val) {
          if (val === null || val === undefined) return this.accountType === 'student';
          return (
            this.accountType === 'supervisor' &&
            Number.isInteger(val) &&
            val >= 1 &&
            val <= 15
          );
        },
        message: 'maxCapacity is supervisor-only and must be an integer between 1 and 15'
      }
    }
  },
  {
    timestamps: true
  }
);

// Ensure passwordHash is never returned when the user document is serialized
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.passwordHash;
  return user;
};

module.exports = mongoose.model('User', userSchema);
