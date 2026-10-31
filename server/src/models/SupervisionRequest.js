const mongoose = require('mongoose');

const supervisionRequestSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project reference is required']
    },
    supervisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Supervisor reference is required']
    },
    proposalMessage: {
      type: String,
      required: [true, 'Proposal message is required'],
      trim: true,
      minlength: [20, 'Proposal message must be at least 20 characters'],
      maxlength: [1000, 'Proposal message cannot exceed 1000 characters']
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'accepted', 'declined'],
        message: 'Status must be pending, accepted, or declined'
      },
      default: 'pending'
    },
    feedback: {
      type: String,
      trim: true,
      maxlength: [500, 'Feedback cannot exceed 500 characters'],
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Enforce single active pending request per project at the database level
supervisionRequestSchema.index(
  { project: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

// Performance index for supervisor inbox filtering and chronological sorting
supervisionRequestSchema.index({ supervisor: 1, status: 1, createdAt: -1 });

// Performance index for project leader request queries
supervisionRequestSchema.index({ project: 1, createdAt: -1 });

module.exports = mongoose.model('SupervisionRequest', supervisionRequestSchema);

