const mongoose = require('mongoose');

const membershipRequestSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project reference is required']
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student reference is required']
    },
    statement: {
      type: String,
      required: [true, 'Statement is required'],
      trim: true,
      minlength: [10, 'Statement must be at least 10 characters'],
      maxlength: [300, 'Statement cannot exceed 300 characters']
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'rejected', 'cancelled'],
        message: 'Status must be pending, approved, rejected, or cancelled'
      },
      default: 'pending'
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate active pending requests from the same student for the same project
membershipRequestSchema.index(
  { project: 1, student: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

// Performance index for querying project requests by status and creation time
membershipRequestSchema.index({ project: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('MembershipRequest', membershipRequestSchema);
