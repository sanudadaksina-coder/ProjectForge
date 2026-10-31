const mongoose = require('mongoose');
const User = require('../models/User');
const Project = require('../models/Project');
const SupervisionRequest = require('../models/SupervisionRequest');

/**
 * GET /api/supervisors
 * Authenticated faculty supervisor directory listing.
 * Supports query parameters:
 *  - search: matches supervisor name or research interests (case-insensitive)
 *  - department: matches supervisor department
 * Returns supervisor profiles with activeProjectsCount and isAvailable.
 * Never exposes passwordHash.
 */
const getSupervisors = async (req, res) => {
  try {
    const { search, department } = req.query;

    const filter = { accountType: 'supervisor' };

    if (department && typeof department === 'string' && department.trim()) {
      filter.department = { $regex: new RegExp(`^${department.trim()}$`, 'i') };
    }

    if (search && typeof search === 'string' && search.trim()) {
      const sanitized = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(sanitized, 'i');
      filter.$or = [
        { name: searchRegex },
        { researchInterests: searchRegex }
      ];
    }

    // Retrieve supervisors omitting passwordHash
    const supervisors = await User.find(filter)
      .select('-passwordHash')
      .sort({ name: 1 })
      .lean();

    if (supervisors.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Supervisors retrieved successfully',
        data: {
          supervisors: []
        },
        errors: null
      });
    }

    const supervisorIds = supervisors.map(s => s._id);

    // Calculate active project workloads in a single aggregation
    // Only 'proposed' and 'in_progress' count toward active supervision capacity
    const activeProjectAgg = await Project.aggregate([
      {
        $match: {
          supervisor: { $in: supervisorIds },
          status: { $in: ['proposed', 'in_progress'] }
        }
      },
      {
        $group: {
          _id: '$supervisor',
          count: { $sum: 1 }
        }
      }
    ]);

    const workloadMap = new Map();
    activeProjectAgg.forEach(item => {
      workloadMap.set(item._id.toString(), item.count);
    });

    const formattedSupervisors = supervisors.map(sup => {
      const activeProjectsCount = workloadMap.get(sup._id.toString()) || 0;
      const maxCap = (typeof sup.maxCapacity === 'number' && sup.maxCapacity >= 1) ? sup.maxCapacity : 5;
      const isAvailable = activeProjectsCount < maxCap;

      return {
        _id: sup._id,
        name: sup.name,
        email: sup.email,
        contactEmail: sup.contactEmail || null,
        department: sup.department,
        designation: sup.designation || null,
        researchInterests: Array.isArray(sup.researchInterests) ? sup.researchInterests : [],
        officeLocation: sup.officeLocation || null,
        maxCapacity: maxCap,
        activeProjectsCount,
        isAvailable
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Supervisors retrieved successfully',
      data: {
        supervisors: formattedSupervisors
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error retrieving supervisor directory.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

/**
 * GET /api/supervisors/:id
 * Authenticated detailed supervisor profile with active project workload.
 */
const getSupervisorById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid supervisor ID format.',
        data: null,
        errors: [
          {
            field: 'id',
            message: 'Supervisor ID must be a valid 24-character hexadecimal ObjectId.'
          }
        ]
      });
    }

    const supervisor = await User.findOne({ _id: id, accountType: 'supervisor' })
      .select('-passwordHash')
      .lean();

    if (!supervisor) {
      return res.status(404).json({
        success: false,
        message: 'Supervisor not found.',
        data: null,
        errors: [{ message: 'No faculty supervisor found with the specified ID.' }]
      });
    }

    const activeProjectsCount = await Project.countDocuments({
      supervisor: id,
      status: { $in: ['proposed', 'in_progress'] }
    });

    const maxCap = (typeof supervisor.maxCapacity === 'number' && supervisor.maxCapacity >= 1)
      ? supervisor.maxCapacity
      : 5;

    return res.status(200).json({
      success: true,
      message: 'Supervisor profile retrieved',
      data: {
        supervisor: {
          _id: supervisor._id,
          name: supervisor.name,
          email: supervisor.email,
          contactEmail: supervisor.contactEmail || null,
          department: supervisor.department,
          designation: supervisor.designation || null,
          researchInterests: Array.isArray(supervisor.researchInterests) ? supervisor.researchInterests : [],
          officeLocation: supervisor.officeLocation || null,
          maxCapacity: maxCap,
          activeProjectsCount
        }
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error retrieving supervisor profile.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

/**
 * GET /api/supervisors/my-requests
 * Authenticated supervisor-only inbox.
 * Query parameters:
 *  - status: 'pending' (default), 'accepted', 'declined'
 */
const getMySupervisionRequests = async (req, res) => {
  try {
    if (req.user.accountType !== 'supervisor') {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: only faculty supervisors can access this inbox.',
        data: null,
        errors: [{ message: 'Caller does not possess supervisor account privileges.' }]
      });
    }

    const { status } = req.query;
    let statusFilter = 'pending';

    if (status !== undefined && status !== null && status !== '') {
      const normalizedStatus = String(status).toLowerCase().trim();
      const validStatuses = ['pending', 'accepted', 'declined'];
      if (!validStatuses.includes(normalizedStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status filter provided.',
          data: null,
          errors: [
            {
              field: 'status',
              message: `Status must be one of: ${validStatuses.join(', ')}.`
            }
          ]
        });
      }
      statusFilter = normalizedStatus;
    }

    const requests = await SupervisionRequest.find({
      supervisor: req.user._id,
      status: statusFilter
    })
      .populate({
        path: 'project',
        select: '_id title abstract domain leader status',
        populate: {
          path: 'leader',
          select: '_id name email department'
        }
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Supervision requests retrieved',
      data: {
        requests
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error retrieving supervision requests.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

/**
 * POST /api/projects/:projectId/supervision-requests
 * Allows the Project Leader (student) to invite a faculty supervisor to advise the project.
 */
const createSupervisionRequest = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { supervisorId, proposalMessage } = req.body;

    // 1. Authorize student role
    if (req.user.accountType !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: only student accounts can lead projects and submit supervision requests.',
        data: null,
        errors: [{ message: 'Supervisors cannot submit supervision requests.' }]
      });
    }

    // 2. Validate projectId
    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format.',
        data: null,
        errors: [
          {
            field: 'projectId',
            message: 'Project ID must be a valid 24-character hexadecimal ObjectId.'
          }
        ]
      });
    }

    // 3. Find project and verify existence
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found.',
        data: null,
        errors: [{ message: 'No project exists with the specified ID.' }]
      });
    }

    // 4. Verify caller is Project Leader
    if (!project.leader.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: only the Project Leader can submit supervision requests.',
        data: null,
        errors: [{ message: 'You are not the designated leader of this project.' }]
      });
    }

    // 5. Verify project does not already have an assigned supervisor
    if (project.supervisor) {
      return res.status(400).json({
        success: false,
        message: 'Project already has an assigned faculty supervisor.',
        data: null,
        errors: [{ message: 'Cannot request supervision for a project that already has an assigned supervisor.' }]
      });
    }

    // 6. Validate supervisorId
    if (!supervisorId || !mongoose.Types.ObjectId.isValid(supervisorId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid supervisor ID format.',
        data: null,
        errors: [
          {
            field: 'supervisorId',
            message: 'Supervisor ID must be a valid 24-character hexadecimal ObjectId.'
          }
        ]
      });
    }

    // 7. Verify supervisor exists and has accountType === 'supervisor'
    const supervisor = await User.findById(supervisorId);
    if (!supervisor || supervisor.accountType !== 'supervisor') {
      return res.status(400).json({
        success: false,
        message: 'Target user is not a valid faculty supervisor.',
        data: null,
        errors: [
          {
            field: 'supervisorId',
            message: 'Target user does not exist or is not registered as a faculty supervisor.'
          }
        ]
      });
    }

    // 8. Validate proposalMessage (20 - 1000 characters)
    if (!proposalMessage || typeof proposalMessage !== 'string' || proposalMessage.trim().length < 20 || proposalMessage.trim().length > 1000) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed on proposal message.',
        data: null,
        errors: [
          {
            field: 'proposalMessage',
            message: 'Proposal message is required and must be between 20 and 1000 characters.'
          }
        ]
      });
    }

    // 9. Enforce single active pending request rule
    const existingPending = await SupervisionRequest.findOne({
      project: projectId,
      status: 'pending'
    });

    if (existingPending) {
      return res.status(409).json({
        success: false,
        message: 'Project already has an active pending supervision request.',
        data: null,
        errors: [
          {
            message: 'A project may have only one pending supervision request at a time.'
          }
        ]
      });
    }

    // 10. Create and persist new supervision request
    const newRequest = new SupervisionRequest({
      project: projectId,
      supervisor: supervisorId,
      proposalMessage: proposalMessage.trim(),
      status: 'pending'
    });

    try {
      await newRequest.save();
    } catch (saveError) {
      // Catch duplicate key error code 11000 from partial unique index
      if (saveError.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Project already has an active pending supervision request.',
          data: null,
          errors: [
            {
              message: 'A project may have only one pending supervision request at a time.'
            }
          ]
        });
      }
      throw saveError;
    }

    return res.status(201).json({
      success: true,
      message: 'Supervision request submitted to faculty supervisor',
      data: {
        request: {
          _id: newRequest._id,
          project: newRequest.project,
          supervisor: newRequest.supervisor,
          proposalMessage: newRequest.proposalMessage,
          status: newRequest.status,
          feedback: newRequest.feedback,
          createdAt: newRequest.createdAt
        }
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error submitting supervision request.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

/**
 * PATCH /api/supervision-requests/:requestId/accept
 * Targeted faculty supervisor accepts a pending proposal.
 * Uses MongoDB transactions and conditional atomic updates to prevent race conditions.
 */
const acceptSupervisionRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

    // 1. Authorize supervisor role
    if (req.user.accountType !== 'supervisor') {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: only faculty supervisors can accept supervision requests.',
        data: null,
        errors: [{ message: 'Insufficient privileges.' }]
      });
    }

    // 2. Validate requestId
    if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request ID format.',
        data: null,
        errors: [
          {
            field: 'requestId',
            message: 'Request ID must be a valid 24-character hexadecimal ObjectId.'
          }
        ]
      });
    }

    // 3. Find supervision request
    const request = await SupervisionRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Supervision request not found.',
        data: null,
        errors: [{ message: 'No supervision request exists with the specified ID.' }]
      });
    }

    // 4. Verify targeted supervisor
    if (!request.supervisor.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: you are not the recipient of this supervision request.',
        data: null,
        errors: [{ message: 'Only the targeted supervisor can accept this request.' }]
      });
    }

    // 5. Verify request is still pending
    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Supervision request cannot be accepted because it is already '${request.status}'.`,
        data: null,
        errors: [{ message: `Request status is ${request.status}. Only pending requests can be accepted.` }]
      });
    }

    // 6. Verify project exists and has no supervisor
    const project = await Project.findById(request.project);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Associated project not found.',
        data: null,
        errors: [{ message: 'The project associated with this request does not exist.' }]
      });
    }

    if (project.supervisor) {
      return res.status(400).json({
        success: false,
        message: 'This project already has an assigned faculty supervisor.',
        data: null,
        errors: [{ message: 'Project is already under supervision.' }]
      });
    }

    // Strictly execute with an ACID MongoDB session transaction.
    // All acceptance writes and validation (supervisor serialization, capacity verification,
    // atomic project assignment, request status update) are executed inside this transaction.
    // No nontransactional fallback is permitted.
    const session = await mongoose.startSession();
    let businessError = null;
    let responseData = null;

    try {
      await session.withTransaction(async () => {
        // 1. Transactionally serialize assignments for this supervisor by acquiring a write lock on the supervisor document
        const supervisorDoc = await User.findOneAndUpdate(
          { _id: req.user._id },
          { $inc: { __v: 1 } },
          { session, returnDocument: 'after' }
        );

        if (!supervisorDoc) {
          businessError = { status: 404, message: 'Supervisor user account not found.' };
          await session.abortTransaction();
          return;
        }

        const maxCap = (typeof supervisorDoc.maxCapacity === 'number') ? supervisorDoc.maxCapacity : 5;

        // 2. Count active projects inside transaction after acquiring supervisor lock
        const activeCount = await Project.countDocuments({
          supervisor: req.user._id,
          status: { $in: ['proposed', 'in_progress'] }
        }).session(session);

        if (activeCount >= maxCap) {
          businessError = {
            status: 400,
            message: `Supervisor capacity limit reached. Maximum active projects allowed is ${maxCap}.`,
            errors: [
              {
                message: `You currently supervise ${activeCount} active projects (limit: ${maxCap}).`
              }
            ]
          };
          await session.abortTransaction();
          return;
        }

        // 3. Re-read request and verify pending inside transaction
        const reqInSession = await SupervisionRequest.findById(requestId).session(session);
        if (!reqInSession || reqInSession.status !== 'pending') {
          businessError = {
            status: 400,
            message: 'Supervision request is no longer pending.',
            errors: [{ message: 'Request status was modified concurrently or is no longer pending.' }]
          };
          await session.abortTransaction();
          return;
        }

        // 4. Atomically assign supervisor to project only if still unassigned
        const updatedProject = await Project.findOneAndUpdate(
          { _id: request.project, supervisor: null },
          { $set: { supervisor: req.user._id } },
          { session, returnDocument: 'after' }
        );

        if (!updatedProject) {
          businessError = {
            status: 400,
            message: 'Project already has an assigned supervisor or was modified concurrently.',
            errors: [{ message: 'Concurrent assignment conflict.' }]
          };
          await session.abortTransaction();
          return;
        }

        // 5. Update request document inside transaction
        reqInSession.status = 'accepted';
        reqInSession.reviewedAt = new Date();
        await reqInSession.save({ session });

        responseData = {
          requestId: reqInSession._id,
          status: 'accepted',
          projectId: updatedProject._id,
          assignedSupervisor: req.user._id
        };
      });
    } finally {
      await session.endSession();
    }

    if (businessError) {
      return res.status(businessError.status).json({
        success: false,
        message: businessError.message,
        data: null,
        errors: businessError.errors || [{ message: businessError.message }]
      });
    }

    if (!responseData) {
      return res.status(500).json({
        success: false,
        message: 'Transaction failed to commit. Supervision request acceptance was aborted.',
        data: null,
        errors: [{ message: 'Transaction could not be completed.' }]
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Supervision request accepted. Project linked to supervisor.',
      data: responseData,
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error accepting supervision request.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

/**
 * PATCH /api/supervision-requests/:requestId/decline
 * Targeted faculty supervisor declines a pending proposal with optional feedback.
 */
const declineSupervisionRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { feedback } = req.body;

    // 1. Authorize supervisor role
    if (req.user.accountType !== 'supervisor') {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: only faculty supervisors can decline supervision requests.',
        data: null,
        errors: [{ message: 'Insufficient privileges.' }]
      });
    }

    // 2. Validate requestId
    if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request ID format.',
        data: null,
        errors: [
          {
            field: 'requestId',
            message: 'Request ID must be a valid 24-character hexadecimal ObjectId.'
          }
        ]
      });
    }

    // 3. Find supervision request
    const request = await SupervisionRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Supervision request not found.',
        data: null,
        errors: [{ message: 'No supervision request exists with the specified ID.' }]
      });
    }

    // 4. Verify targeted supervisor
    if (!request.supervisor.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: you are not the recipient of this supervision request.',
        data: null,
        errors: [{ message: 'Only the targeted supervisor can decline this request.' }]
      });
    }

    // 5. Verify request is still pending
    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Supervision request cannot be declined because it is already '${request.status}'.`,
        data: null,
        errors: [{ message: `Request status is ${request.status}. Only pending requests can be declined.` }]
      });
    }

    // 6. Validate optional feedback (max 500 characters)
    let sanitizedFeedback = null;
    if (feedback !== undefined && feedback !== null && feedback !== '') {
      if (typeof feedback !== 'string' || feedback.trim().length > 500) {
        return res.status(422).json({
          success: false,
          message: 'Validation failed on decline feedback.',
          data: null,
          errors: [
            {
              field: 'feedback',
              message: 'Feedback cannot exceed 500 characters.'
            }
          ]
        });
      }
      sanitizedFeedback = feedback.trim();
    }

    // 7. Update status to declined (Project.supervisor remains untouched)
    request.status = 'declined';
    request.feedback = sanitizedFeedback;
    request.reviewedAt = new Date();
    await request.save();

    return res.status(200).json({
      success: true,
      message: 'Supervision request declined',
      data: {
        requestId: request._id,
        status: 'declined',
        feedback: request.feedback
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error declining supervision request.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

/**
 * GET /api/projects/:projectId/supervision-requests
 * Intentional additive contract extension:
 * Allows the Project Leader to inspect all supervision proposals sent for their project,
 * ordered chronologically newest first.
 */
const getProjectSupervisionRequests = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format.',
        data: null,
        errors: [
          {
            field: 'projectId',
            message: 'Project ID must be a valid 24-character hexadecimal ObjectId.'
          }
        ]
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found.',
        data: null,
        errors: [{ message: 'No project exists with the specified ID.' }]
      });
    }

    // Restrict access to Project Leader
    if (!project.leader.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: only the Project Leader can view supervision request history.',
        data: null,
        errors: [{ message: 'Only the project leader is authorized to view this request history.' }]
      });
    }

    const requests = await SupervisionRequest.find({ project: projectId })
      .populate('supervisor', '_id name email contactEmail department designation researchInterests officeLocation')
      .sort({ createdAt: -1 });

    const formattedRequests = requests.map(r => ({
      _id: r._id,
      project: r.project,
      supervisor: r.supervisor ? {
        _id: r.supervisor._id,
        name: r.supervisor.name,
        email: r.supervisor.email,
        contactEmail: r.supervisor.contactEmail || null,
        department: r.supervisor.department,
        designation: r.supervisor.designation || null,
        researchInterests: r.supervisor.researchInterests || [],
        officeLocation: r.supervisor.officeLocation || null
      } : null,
      proposalMessage: r.proposalMessage,
      status: r.status,
      feedback: r.feedback,
      reviewedAt: r.reviewedAt,
      createdAt: r.createdAt
    }));

    return res.status(200).json({
      success: true,
      message: 'Project supervision requests retrieved successfully',
      data: {
        requests: formattedRequests
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error retrieving project supervision requests.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

module.exports = {
  getSupervisors,
  getSupervisorById,
  getMySupervisionRequests,
  createSupervisionRequest,
  acceptSupervisionRequest,
  declineSupervisionRequest,
  getProjectSupervisionRequests
};
