const mongoose = require('mongoose');

const URL_REGEX = /^https?:\/\/.+/i;

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Project title is required'],
      trim: true,
      minlength: [5, 'Project title must be at least 5 characters'],
      maxlength: [120, 'Project title cannot exceed 120 characters']
    },
    abstract: {
      type: String,
      required: [true, 'Project abstract is required'],
      trim: true,
      minlength: [20, 'Abstract must be at least 20 characters'],
      maxlength: [1500, 'Abstract cannot exceed 1500 characters']
    },
    domain: {
      type: String,
      required: [true, 'Engineering domain is required'],
      enum: {
        values: [
          'Computer',
          'Electrical',
          'Mechanical',
          'Civil',
          'Biomedical',
          'Multidisciplinary'
        ],
        message: 'Invalid engineering domain'
      }
    },
    tags: {
      type: [String],
      default: []
    },
    leader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Project leader is required']
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    supervisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    maxTeamSize: {
      type: Number,
      required: [true, 'Maximum team size is required'],
      min: [2, 'Team size must be at least 2 (leader + 1 member)'],
      max: [6, 'Team size cannot exceed 6 for undergraduate projects'],
      default: 4
    },
    targetCompletionDate: {
      type: Date,
      required: [true, 'Target completion date is required']
    },
    status: {
      type: String,
      enum: {
        values: ['proposed', 'in_progress', 'completed'],
        message: 'Status must be proposed, in_progress, or completed'
      },
      default: 'proposed'
    },
    recruitmentStatus: {
      type: String,
      enum: {
        values: ['open', 'closed'],
        message: 'Recruitment status must be open or closed'
      },
      default: 'open'
    },
    pulseScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    repositoryUrl: {
      type: String,
      trim: true,
      default: '',
      validate: {
        validator: function(val) {
          if (!val || val === '') return true;
          return URL_REGEX.test(val);
        },
        message: 'Repository URL must be a valid HTTP or HTTPS web address'
      }
    }
  },
  {
    timestamps: true
  }
);

// Search and filtering performance indexes
projectSchema.index({ title: 'text', abstract: 'text', tags: 'text' });
projectSchema.index({ domain: 1, status: 1, recruitmentStatus: 1 });

module.exports = mongoose.model('Project', projectSchema);
