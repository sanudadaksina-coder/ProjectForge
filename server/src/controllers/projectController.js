const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Project = require('../models/Project');
const MembershipRequest = require('../models/MembershipRequest');
const Task = require('../models/Task');
const SupervisionRequest = require('../models/SupervisionRequest');
const { getJwtSecret } = require('../utils/token');

const VALID_DOMAINS = [
  'Computer',
  'Electrical',
  'Mechanical',
  'Civil',
  'Biomedical',
  'Multidisciplinary'
];

const VALID_STATUSES = ['proposed', 'in_progress', 'completed'];
const VALID_RECRUITMENT = ['open', 'closed'];
const VALID_SORTS = ['newest', 'oldest', 'deadline', 'pulse'];
const URL_REGEX = /^https?:\/\/.+/i;

/**
 * Helper to optionally extract authenticated user ID from cookie or Bearer token.
 * Returns user ID string if authenticated, or null.
 */
const getOptionalUserId = (req) => {
  try {
    let token = null;
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return null;
    const decoded = jwt.verify(token, getJwtSecret());
    return decoded.id ? String(decoded.id) : null;
  } catch (err) {
    return null;
  }
};

/**
 * POST /api/projects
 * Creates a new academic engineering project workspace.
 * Restricted to authenticated student accounts.
 */
const createProject = async (req, res) => {
  try {
    // 1. Authorize: Only student accounts can create projects
    if (req.user.accountType !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Supervisors cannot create projects.',
        data: null,
        errors: [
          {
            message: 'Only student accounts are authorized to propose new projects.'
          }
        ]
      });
    }

    const {
      title,
      abstract,
      domain,
      tags,
      maxTeamSize = 4,
      targetCompletionDate,
      repositoryUrl = ''
    } = req.body;

    const errors = [];

    // 2. Validate mandatory fields
    if (!title || typeof title !== 'string' || title.trim().length < 5 || title.trim().length > 120) {
      errors.push({
        field: 'title',
        message: 'Project title is required and must be between 5 and 120 characters.'
      });
    }

    if (!abstract || typeof abstract !== 'string' || abstract.trim().length < 20 || abstract.trim().length > 1500) {
      errors.push({
        field: 'abstract',
        message: 'Project abstract is required and must be between 20 and 1500 characters.'
      });
    }

    if (!domain || !VALID_DOMAINS.includes(domain)) {
      errors.push({
        field: 'domain',
        message: `Engineering domain is required and must be one of: ${VALID_DOMAINS.join(', ')}.`
      });
    }

    const parsedTeamSize = Number(maxTeamSize);
    if (!Number.isInteger(parsedTeamSize) || parsedTeamSize < 2 || parsedTeamSize > 6) {
      errors.push({
        field: 'maxTeamSize',
        message: 'Maximum team size must be an integer between 2 and 6.'
      });
    }

    if (!targetCompletionDate) {
      errors.push({
        field: 'targetCompletionDate',
        message: 'Target completion date is required.'
      });
    } else {
      const parsedDate = new Date(targetCompletionDate);
      if (isNaN(parsedDate.getTime())) {
        errors.push({
          field: 'targetCompletionDate',
          message: 'Target completion date must be a valid date.'
        });
      } else if (parsedDate <= new Date()) {
        errors.push({
          field: 'targetCompletionDate',
          message: 'Target completion date must be in the future.'
        });
      }
    }

    if (repositoryUrl && typeof repositoryUrl === 'string' && repositoryUrl.trim() !== '') {
      if (!URL_REGEX.test(repositoryUrl.trim())) {
        errors.push({
          field: 'repositoryUrl',
          message: 'Repository URL must be a valid HTTP or HTTPS web address.'
        });
      }
    }

    if (errors.length > 0) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed.',
        data: null,
        errors
      });
    }

    // 3. Initialize project with structural defaults
    // Leader is set exclusively from the authenticated session, never from client input.
    // Leader is initialized as the first member and counts toward maxTeamSize.
    const newProject = new Project({
      title: title.trim(),
      abstract: abstract.trim(),
      domain,
      tags: Array.isArray(tags) ? tags.map(t => String(t).trim()).filter(Boolean) : [],
      leader: req.user._id,
      members: [req.user._id],
      supervisor: null,
      maxTeamSize: parsedTeamSize,
      targetCompletionDate: new Date(targetCompletionDate),
      status: 'proposed',
      recruitmentStatus: 'open',
      pulseScore: 0,
      repositoryUrl: repositoryUrl ? repositoryUrl.trim() : ''
    });

    await newProject.save();

    return res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: {
        project: newProject
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error creating project.',
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
 * GET /api/projects
 * Public project discovery with search, filter, sort, and pagination.
 */
const getProjects = async (req, res) => {
  try {
    const {
      search,
      domain,
      status,
      recruitment,
      sort = 'newest',
      page = 1,
      limit = 10
    } = req.query;

    // 1. Validate pagination parameters
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);

    if (isNaN(parsedPage) || isNaN(parsedLimit) || parsedPage < 1 || parsedLimit < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pagination parameters.',
        data: null,
        errors: [
          {
            field: 'pagination',
            message: 'Page and limit must be positive integers.'
          }
        ]
      });
    }

    const constrainedLimit = Math.min(parsedLimit, 50);

    // 2. Build query filters
    const filter = {};

    if (domain) {
      if (VALID_DOMAINS.includes(domain)) {
        filter.domain = domain;
      }
    }

    if (status) {
      if (VALID_STATUSES.includes(status)) {
        filter.status = status;
      }
    }

    if (recruitment) {
      if (VALID_RECRUITMENT.includes(recruitment)) {
        filter.recruitmentStatus = recruitment;
      }
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const s = search.trim();
      filter.$or = [
        { title: { $regex: s, $options: 'i' } },
        { abstract: { $regex: s, $options: 'i' } },
        { tags: { $regex: s, $options: 'i' } }
      ];
    }

    // 3. Build sorting criteria
    let sortObj = { createdAt: -1 };
    if (sort === 'oldest') {
      sortObj = { createdAt: 1 };
    } else if (sort === 'deadline') {
      sortObj = { targetCompletionDate: 1 };
    } else if (sort === 'pulse') {
      sortObj = { pulseScore: -1 };
    }

    // 4. Execute query with count
    const total = await Project.countDocuments(filter);
    const pages = Math.ceil(total / constrainedLimit) || 1;

    const rawProjects = await Project.find(filter)
      .sort(sortObj)
      .skip((parsedPage - 1) * constrainedLimit)
      .limit(constrainedLimit)
      .populate('leader', 'name department')
      .populate('supervisor', 'name department designation');

    // 5. Transform projects into safe public representation
    const formattedProjects = rawProjects.map(p => ({
      _id: p._id,
      title: p.title,
      abstract: p.abstract,
      domain: p.domain,
      tags: p.tags,
      leader: p.leader ? {
        _id: p.leader._id,
        name: p.leader.name,
        department: p.leader.department
      } : null,
      membersCount: Array.isArray(p.members) ? p.members.length : 1,
      maxTeamSize: p.maxTeamSize,
      supervisor: p.supervisor ? {
        _id: p.supervisor._id,
        name: p.supervisor.name,
        department: p.supervisor.department,
        designation: p.supervisor.designation
      } : null,
      status: p.status,
      recruitmentStatus: p.recruitmentStatus,
      pulseScore: p.pulseScore,
      targetCompletionDate: p.targetCompletionDate,
      createdAt: p.createdAt
    }));

    return res.status(200).json({
      success: true,
      message: 'Projects retrieved successfully',
      data: {
        projects: formattedProjects,
        pagination: {
          page: parsedPage,
          limit: constrainedLimit,
          total,
          pages
        }
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error retrieving projects.',
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
 * GET /api/projects/:id
 * Retrieves project details:
 * - Public View: For unauthenticated visitors and non-members (sanitizes private contact info).
 * - Private Workspace View: For authorized leader, members, and supervisor (returns full contact details).
 */
const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format.',
        data: null,
        errors: [
          {
            field: 'id',
            message: 'Project ID must be a valid 24-character hexadecimal ObjectId.'
          }
        ]
      });
    }

    const project = await Project.findById(id)
      .populate('leader', 'name email department studentId')
      .populate('members', 'name email department skills studentId')
      .populate('supervisor', 'name email contactEmail department designation researchInterests officeLocation');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found.',
        data: null,
        errors: [
          {
            message: 'No project found with the specified ID.'
          }
        ]
      });
    }

    // Determine authorization for private workspace view
    const currentUserId = getOptionalUserId(req);
    let isAuthorizedCollaborator = false;

    if (currentUserId) {
      const isLeader = project.leader && project.leader._id.toString() === currentUserId;
      const isMember = Array.isArray(project.members) && project.members.some(m => m._id.toString() === currentUserId);
      const isSupervisor = project.supervisor && project.supervisor._id.toString() === currentUserId;
      isAuthorizedCollaborator = isLeader || isMember || isSupervisor;
    }

    // 1. Private Workspace View (Authorized Leader, Members, and Assigned Supervisor)
    if (isAuthorizedCollaborator) {
      return res.status(200).json({
        success: true,
        message: 'Project workspace details retrieved successfully',
        data: {
          project: {
            _id: project._id,
            title: project.title,
            abstract: project.abstract,
            domain: project.domain,
            tags: project.tags,
            leader: project.leader ? {
              _id: project.leader._id,
              name: project.leader.name,
              email: project.leader.email,
              department: project.leader.department,
              studentId: project.leader.studentId
            } : null,
            members: project.members.map(m => ({
              _id: m._id,
              name: m.name,
              email: m.email,
              department: m.department,
              studentId: m.studentId,
              skills: m.skills
            })),
            supervisor: project.supervisor ? {
              _id: project.supervisor._id,
              name: project.supervisor.name,
              email: project.supervisor.email,
              contactEmail: project.supervisor.contactEmail || null,
              department: project.supervisor.department,
              designation: project.supervisor.designation,
              researchInterests: project.supervisor.researchInterests,
              officeLocation: project.supervisor.officeLocation
            } : null,
            maxTeamSize: project.maxTeamSize,
            targetCompletionDate: project.targetCompletionDate,
            status: project.status,
            recruitmentStatus: project.recruitmentStatus,
            pulseScore: project.pulseScore,
            repositoryUrl: project.repositoryUrl,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt
          }
        },
        errors: null
      });
    }

    // 2. Public Project View (Unauthenticated Visitors & Non-Members)
    return res.status(200).json({
      success: true,
      message: 'Public project details retrieved successfully',
      data: {
        project: {
          _id: project._id,
          title: project.title,
          abstract: project.abstract,
          domain: project.domain,
          tags: project.tags,
          leader: project.leader ? {
            _id: project.leader._id,
            name: project.leader.name,
            department: project.leader.department
          } : null,
          members: project.members.map(m => ({
            _id: m._id,
            name: m.name,
            department: m.department,
            skills: m.skills
          })),
          supervisor: project.supervisor ? {
            _id: project.supervisor._id,
            name: project.supervisor.name,
            department: project.supervisor.department,
            designation: project.supervisor.designation
          } : null,
          maxTeamSize: project.maxTeamSize,
          targetCompletionDate: project.targetCompletionDate,
          status: project.status,
          recruitmentStatus: project.recruitmentStatus,
          pulseScore: project.pulseScore,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt
        }
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error retrieving project details.',
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
 * PATCH /api/projects/:id
 * Performs partial updates on project metadata.
 * Restricted to the authenticated Project Leader.
 */
const updateProject = async (req, res) => {
  try {
    const project = req.project; // Pre-loaded & authorized by requireProjectLeader middleware

    // 1. Enforce Protected Fields Rule:
    // Reject any attempt to modify structural/system-managed fields directly via PATCH.
    const PROTECTED_FIELDS = ['leader', 'members', 'supervisor', 'pulseScore'];
    const forbiddenProvided = PROTECTED_FIELDS.filter(field => req.body[field] !== undefined);

    if (forbiddenProvided.length > 0) {
      return res.status(422).json({
        success: false,
        message: `Protected fields cannot be modified via project update: ${forbiddenProvided.join(', ')}`,
        data: null,
        errors: forbiddenProvided.map(field => ({
          field,
          message: `Field '${field}' is protected and cannot be altered through general metadata updates.`
        }))
      });
    }

    const {
      title,
      abstract,
      domain,
      tags,
      maxTeamSize,
      targetCompletionDate,
      status,
      repositoryUrl
    } = req.body;

    const errors = [];

    // 2. Validate update fields if supplied
    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length < 5 || title.trim().length > 120) {
        errors.push({
          field: 'title',
          message: 'Title must be between 5 and 120 characters.'
        });
      } else {
        project.title = title.trim();
      }
    }

    if (abstract !== undefined) {
      if (typeof abstract !== 'string' || abstract.trim().length < 20 || abstract.trim().length > 1500) {
        errors.push({
          field: 'abstract',
          message: 'Abstract must be between 20 and 1500 characters.'
        });
      } else {
        project.abstract = abstract.trim();
      }
    }

    if (domain !== undefined) {
      if (!VALID_DOMAINS.includes(domain)) {
        errors.push({
          field: 'domain',
          message: `Engineering domain must be one of: ${VALID_DOMAINS.join(', ')}.`
        });
      } else {
        project.domain = domain;
      }
    }

    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        errors.push({
          field: 'tags',
          message: 'Tags must be an array of strings.'
        });
      } else {
        project.tags = tags.map(t => String(t).trim()).filter(Boolean);
      }
    }

    if (maxTeamSize !== undefined) {
      const parsedSize = Number(maxTeamSize);
      if (!Number.isInteger(parsedSize) || parsedSize < 2 || parsedSize > 6) {
        errors.push({
          field: 'maxTeamSize',
          message: 'Team size must be an integer between 2 and 6.'
        });
      } else if (parsedSize < project.members.length) {
        errors.push({
          field: 'maxTeamSize',
          message: `maxTeamSize cannot be smaller than current member count (${project.members.length}).`
        });
      } else {
        project.maxTeamSize = parsedSize;
      }
    }

    if (targetCompletionDate !== undefined) {
      const parsedDate = new Date(targetCompletionDate);
      if (isNaN(parsedDate.getTime())) {
        errors.push({
          field: 'targetCompletionDate',
          message: 'Target completion date must be a valid date.'
        });
      } else if (parsedDate <= new Date()) {
        errors.push({
          field: 'targetCompletionDate',
          message: 'Target completion date must be in the future.'
        });
      } else {
        project.targetCompletionDate = parsedDate;
      }
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        errors.push({
          field: 'status',
          message: 'Status must be proposed, in_progress, or completed.'
        });
      } else {
        project.status = status;
      }
    }

    if (repositoryUrl !== undefined) {
      const trimmedUrl = String(repositoryUrl).trim();
      if (trimmedUrl !== '' && !URL_REGEX.test(trimmedUrl)) {
        errors.push({
          field: 'repositoryUrl',
          message: 'Repository URL must be a valid HTTP or HTTPS web address.'
        });
      } else {
        project.repositoryUrl = trimmedUrl;
      }
    }

    if (errors.length > 0) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed.',
        data: null,
        errors
      });
    }

    await project.save();

    return res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: {
        project
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error updating project.',
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
 * DELETE /api/projects/:id
 * Permanently deletes a project workspace.
 * Restricted to the authenticated Project Leader.
 *
 * NOTE FOR FUTURE STAGES:
 * In Stage 1, only the Project document is deleted since child collections do not yet exist.
 * When Stage 2 and Stage 3 are implemented, child documents MUST be cleaned up before parent:
 *   await Promise.all([
 *     Task.deleteMany({ project: id }),
 *     MembershipRequest.deleteMany({ project: id }),
 *     SupervisionRequest.deleteMany({ project: id }),
 *     DocumentLink.deleteMany({ project: id }),
 *     DiscussionComment.deleteMany({ project: id }),
 *     Submission.deleteMany({ project: id })
 *   ]);
 */
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    // Clean up child tasks, membership requests, and supervision requests before deleting parent project document
    await Promise.all([
      Task.deleteMany({ project: id }),
      MembershipRequest.deleteMany({ project: id }),
      SupervisionRequest.deleteMany({ project: id })
    ]);
    await Project.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
      data: null,
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error deleting project.',
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
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject
};
