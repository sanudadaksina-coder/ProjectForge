const mongoose = require('mongoose');
const Project = require('../models/Project');
const MembershipRequest = require('../models/MembershipRequest');
const Task = require('../models/Task');

const VALID_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];

/**
 * POST /api/projects/:projectId/join-requests
 * Submits an application for a student to join an open project team.
 * Restricted to authenticated student accounts.
 */
const createJoinRequest = async (req, res) => {
  try {
    // 1. Authorize: Only student accounts can submit join requests
    if (req.user.accountType !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Supervisors cannot apply to join projects.',
        data: null,
        errors: [
          {
            message: 'Only student accounts are authorized to submit join requests.'
          }
        ]
      });
    }

    const { projectId } = req.params;

    // 2. Validate projectId format
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

    // 3. Validate statement field (10-300 characters)
    const { statement } = req.body || {};
    if (
      statement === undefined ||
      statement === null ||
      typeof statement !== 'string' ||
      statement.trim().length < 10 ||
      statement.trim().length > 300
    ) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed.',
        data: null,
        errors: [
          {
            field: 'statement',
            message: 'Statement is required and must be between 10 and 300 characters.'
          }
        ]
      });
    }

    // 4. Fetch target project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found.',
        data: null,
        errors: [
          {
            message: 'No project exists with the specified ID.'
          }
        ]
      });
    }

    // 5. Invariant check: Leader cannot apply to their own project
    if (project.leader.equals(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'Project leader cannot apply to join their own project.',
        data: null,
        errors: [
          {
            message: 'You are already the leader of this project.'
          }
        ]
      });
    }

    // 6. Invariant check: Already a team member
    if (project.members.some(memberId => memberId.equals(req.user._id))) {
      return res.status(409).json({
        success: false,
        message: 'User is already a team member of this project.',
        data: null,
        errors: [
          {
            message: 'You are already a member of this project roster.'
          }
        ]
      });
    }

    // 7. Invariant check: Recruitment closed
    if (project.recruitmentStatus === 'closed') {
      return res.status(400).json({
        success: false,
        message: 'Recruitment is closed for this project.',
        data: null,
        errors: [
          {
            message: 'This project is not currently accepting new team members.'
          }
        ]
      });
    }

    // 8. Invariant check: Team is already full
    if (project.members.length >= project.maxTeamSize) {
      return res.status(400).json({
        success: false,
        message: 'Project team has reached maximum capacity.',
        data: null,
        errors: [
          {
            message: `Team has reached its maximum size of ${project.maxTeamSize} members.`
          }
        ]
      });
    }

    // 9. Invariant check: Duplicate active pending request
    const existingPending = await MembershipRequest.findOne({
      project: projectId,
      student: req.user._id,
      status: 'pending'
    });

    if (existingPending) {
      return res.status(409).json({
        success: false,
        message: 'You already have a pending join request for this project.',
        data: null,
        errors: [
          {
            message: 'Wait for the project leader to review your existing request before submitting another.'
          }
        ]
      });
    }

    // 10. Persist new join request
    try {
      const joinRequest = await MembershipRequest.create({
        project: projectId,
        student: req.user._id,
        statement: statement.trim(),
        status: 'pending'
      });

      return res.status(201).json({
        success: true,
        message: 'Join request submitted successfully',
        data: {
          request: {
            _id: joinRequest._id,
            project: joinRequest.project,
            student: joinRequest.student,
            statement: joinRequest.statement,
            status: joinRequest.status,
            createdAt: joinRequest.createdAt
          }
        },
        errors: null
      });
    } catch (createErr) {
      if (createErr.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'You already have a pending join request for this project.',
          data: null,
          errors: [
            {
              message: 'Wait for the project leader to review your existing request before submitting another.'
            }
          ]
        });
      }
      throw createErr;
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error submitting join request.',
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
 * GET /api/projects/:projectId/join-requests
 * Lists incoming join requests for a project.
 * Restricted to the authenticated Project Leader.
 */
const getProjectJoinRequests = async (req, res) => {
  try {
    const projectId = req.params.projectId || req.params.id;

    // Optional status filter (default: 'pending')
    const { status = 'pending' } = req.query;

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status filter parameter.',
        data: null,
        errors: [
          {
            field: 'status',
            message: `Status must be one of: ${VALID_STATUSES.join(', ')}`
          }
        ]
      });
    }

    const requests = await MembershipRequest.find({
      project: projectId,
      status
    })
      .populate('student', '_id name email department skills semester')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Join requests retrieved successfully',
      data: {
        requests: requests.map(r => ({
          _id: r._id,
          student: r.student,
          statement: r.statement,
          status: r.status,
          createdAt: r.createdAt
        }))
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error retrieving join requests.',
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
 * GET /api/membership-requests/mine
 * Retrieves join requests submitted by the currently authenticated student.
 * Optional query parameters:
 *   - projectId: filters to a specific project
 *   - status: filters by request status (pending, approved, rejected, cancelled)
 * Strictly restricted to records where student === req.user._id.
 */
const getMyMembershipRequests = async (req, res) => {
  try {
    const { projectId, status } = req.query;

    const query = { student: req.user._id };

    if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
      query.project = projectId;
    }

    if (status && VALID_STATUSES.includes(status)) {
      query.status = status;
    }

    const requests = await MembershipRequest.find(query)
      .populate('project', '_id title domain status recruitmentStatus maxTeamSize')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Student membership requests retrieved successfully',
      data: {
        requests: requests.map(r => ({
          _id: r._id,
          project: r.project,
          student: r.student,
          statement: r.statement,
          status: r.status,
          createdAt: r.createdAt
        }))
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error retrieving student membership requests.',
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
 * PATCH /api/membership-requests/:requestId/approve
 * Approves a pending join request and appends student to project members.
 * Concurrency-safe: atomically verifies capacity and prevents overcapacity.
 * Restricted to the authenticated Project Leader.
 */
const approveJoinRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

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

    // 1. Fetch request
    const request = await MembershipRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Membership request not found.',
        data: null,
        errors: [
          {
            message: 'No membership request exists with the specified ID.'
          }
        ]
      });
    }

    // 2. Validate current request status is pending
    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Request is not in pending status.',
        data: null,
        errors: [
          {
            message: `Membership request status is already '${request.status}'.`
          }
        ]
      });
    }

    // 3. Fetch project and verify leader authorization
    const project = await Project.findById(request.project);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Associated project not found.',
        data: null,
        errors: [
          {
            message: 'No project exists for this membership request.'
          }
        ]
      });
    }

    if (!project.leader.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: only the Project Leader can approve membership requests.',
        data: null,
        errors: [
          {
            message: 'You are not the authorized leader of this project.'
          }
        ]
      });
    }

    // 4. Invariant pre-checks
    if (project.recruitmentStatus === 'closed') {
      return res.status(400).json({
        success: false,
        message: 'Project recruitment is closed.',
        data: null,
        errors: [
          {
            message: 'Cannot approve request because recruitment is currently closed.'
          }
        ]
      });
    }

    if (project.members.length >= project.maxTeamSize) {
      return res.status(400).json({
        success: false,
        message: 'Project team has reached maximum capacity.',
        data: null,
        errors: [
          {
            message: `Team has reached its maximum size of ${project.maxTeamSize} members.`
          }
        ]
      });
    }

    // 5. Concurrency-safe atomic member addition:
    // Only appends student if members.length < maxTeamSize and student not already member
    const updatedProject = await Project.findOneAndUpdate(
      {
        _id: request.project,
        recruitmentStatus: 'open',
        $expr: { $lt: [{ $size: '$members' }, '$maxTeamSize'] },
        members: { $ne: request.student }
      },
      {
        $addToSet: { members: request.student }
      },
      { returnDocument: 'after' }
    );

    if (!updatedProject) {
      // Re-inspect project to return the exact descriptive error
      const currentProj = await Project.findById(request.project);
      if (!currentProj) {
        return res.status(404).json({
          success: false,
          message: 'Project not found.',
          data: null,
          errors: [{ message: 'Associated project no longer exists.' }]
        });
      }

      if (currentProj.members.length >= currentProj.maxTeamSize) {
        return res.status(400).json({
          success: false,
          message: 'Project team has reached maximum capacity.',
          data: null,
          errors: [
            {
              message: `Team is already full (${currentProj.members.length}/${currentProj.maxTeamSize}).`
            }
          ]
        });
      }

      if (currentProj.recruitmentStatus === 'closed') {
        return res.status(400).json({
          success: false,
          message: 'Project recruitment is closed.',
          data: null,
          errors: [
            {
              message: 'Cannot approve join request when recruitment is closed.'
            }
          ]
        });
      }

      if (currentProj.members.some(m => m.equals(request.student))) {
        return res.status(400).json({
          success: false,
          message: 'Student is already a team member.',
          data: null,
          errors: [
            {
              message: 'Applicant is already present in the project roster.'
            }
          ]
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Unable to approve membership request due to project constraints.',
        data: null,
        errors: [
          {
            message: 'Capacity or status constraint violated.'
          }
        ]
      });
    }

    // 6. Atomically transition request status from pending to approved
    const updatedRequest = await MembershipRequest.findOneAndUpdate(
      { _id: requestId, status: 'pending' },
      { status: 'approved' },
      { returnDocument: 'after' }
    );

    if (!updatedRequest) {
      // Roll back the project member addition if request was cancelled/modified concurrently
      await Project.findByIdAndUpdate(request.project, {
        $pull: { members: request.student }
      });

      return res.status(400).json({
        success: false,
        message: 'Request is not in pending status.',
        data: null,
        errors: [
          {
            message: 'This membership request has already been processed or cancelled.'
          }
        ]
      });
    }

    // 7. Auto-closure: If team reaches capacity, automatically close recruitment
    let finalRecruitmentStatus = updatedProject.recruitmentStatus;
    if (
      updatedProject.members.length >= updatedProject.maxTeamSize &&
      updatedProject.recruitmentStatus !== 'closed'
    ) {
      finalRecruitmentStatus = 'closed';
      await Project.findByIdAndUpdate(request.project, {
        recruitmentStatus: 'closed'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Membership request approved; member added to team',
      data: {
        requestId: String(updatedRequest._id),
        status: 'approved',
        project: {
          _id: String(updatedProject._id),
          membersCount: updatedProject.members.length,
          maxTeamSize: updatedProject.maxTeamSize,
          recruitmentStatus: finalRecruitmentStatus
        }
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error approving membership request.',
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
 * PATCH /api/membership-requests/:requestId/reject
 * Rejects a pending join request.
 * Restricted to the authenticated Project Leader.
 */
const rejectJoinRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

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

    const request = await MembershipRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Membership request not found.',
        data: null,
        errors: [
          {
            message: 'No membership request exists with the specified ID.'
          }
        ]
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Request is not in pending status.',
        data: null,
        errors: [
          {
            message: `Membership request status is already '${request.status}'.`
          }
        ]
      });
    }

    const project = await Project.findById(request.project);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Associated project not found.',
        data: null,
        errors: [
          {
            message: 'No project exists for this membership request.'
          }
        ]
      });
    }

    if (!project.leader.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: only the Project Leader can reject membership requests.',
        data: null,
        errors: [
          {
            message: 'You are not the authorized leader of this project.'
          }
        ]
      });
    }

    const updatedRequest = await MembershipRequest.findOneAndUpdate(
      { _id: requestId, status: 'pending' },
      { status: 'rejected' },
      { returnDocument: 'after' }
    );

    if (!updatedRequest) {
      return res.status(400).json({
        success: false,
        message: 'Request is not in pending status.',
        data: null,
        errors: [
          {
            message: 'This membership request has already been processed or cancelled.'
          }
        ]
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Membership request rejected',
      data: {
        requestId: String(updatedRequest._id),
        status: 'rejected'
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error rejecting membership request.',
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
 * PATCH /api/membership-requests/:requestId/cancel
 * Withdraws a student's own pending join request.
 * Restricted to the applicant student who submitted the request.
 */
const cancelJoinRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

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

    const request = await MembershipRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Membership request not found.',
        data: null,
        errors: [
          {
            message: 'No membership request exists with the specified ID.'
          }
        ]
      });
    }

    // Verify applicant authorization
    if (!request.student.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: you can only cancel your own membership requests.',
        data: null,
        errors: [
          {
            message: 'You are not the applicant who submitted this join request.'
          }
        ]
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Request is not in pending status.',
        data: null,
        errors: [
          {
            message: `Membership request status is already '${request.status}'.`
          }
        ]
      });
    }

    const updatedRequest = await MembershipRequest.findOneAndUpdate(
      { _id: requestId, status: 'pending' },
      { status: 'cancelled' },
      { returnDocument: 'after' }
    );

    if (!updatedRequest) {
      return res.status(400).json({
        success: false,
        message: 'Request is not in pending status.',
        data: null,
        errors: [
          {
            message: 'This membership request has already been processed or cancelled.'
          }
        ]
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Join request cancelled',
      data: {
        requestId: String(updatedRequest._id),
        status: 'cancelled'
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error cancelling join request.',
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
 * DELETE /api/projects/:projectId/members/:userId
 * Removes an approved student member from the project roster.
 * Invariant: Leader cannot remove themselves.
 * Invariant: If recruitment was closed and membersCount < maxTeamSize, reopens recruitment.
 * Restricted to the authenticated Project Leader.
 */
const removeMember = async (req, res) => {
  try {
    const { projectId, userId } = req.params;

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

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format.',
        data: null,
        errors: [
          {
            field: 'userId',
            message: 'User ID must be a valid 24-character hexadecimal ObjectId.'
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
        errors: [
          {
            message: 'No project exists with the specified ID.'
          }
        ]
      });
    }

    // Verify leader authorization
    if (!project.leader.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: only the Project Leader can remove team members.',
        data: null,
        errors: [
          {
            message: 'You are not the authorized leader of this project.'
          }
        ]
      });
    }

    // Invariant: Leader cannot remove themselves
    if (project.leader.equals(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Leader cannot be removed from project.',
        data: null,
        errors: [
          {
            message: 'Project leader cannot be removed from the project roster.'
          }
        ]
      });
    }

    // Invariant: Target user must be an active member
    const isMember = project.members.some(m => m.toString() === userId.toString());
    if (!isMember) {
      return res.status(404).json({
        success: false,
        message: 'User is not an active member of this project.',
        data: null,
        errors: [
          {
            message: 'Specified user ID is not found in the project members roster.'
          }
        ]
      });
    }

    // Atomically pull member from project roster
    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      { $pull: { members: userId } },
      { returnDocument: 'after' }
    );

    // Unassign tasks assigned to the removed member to prevent dangling references
    await Task.updateMany(
      { project: projectId, assignedTo: userId },
      { $set: { assignedTo: null } }
    );

    // Recruitment Re-Opening:
    // If recruitmentStatus was 'closed' and members.length < maxTeamSize, automatically reopen
    let finalRecruitmentStatus = updatedProject.recruitmentStatus;
    if (
      updatedProject.recruitmentStatus === 'closed' &&
      updatedProject.members.length < updatedProject.maxTeamSize
    ) {
      finalRecruitmentStatus = 'open';
      await Project.findByIdAndUpdate(projectId, {
        recruitmentStatus: 'open'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Member removed from project roster',
      data: {
        removedUserId: String(userId),
        membersCount: updatedProject.members.length,
        recruitmentStatus: finalRecruitmentStatus
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error removing team member.',
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
  createJoinRequest,
  getProjectJoinRequests,
  getMyMembershipRequests,
  approveJoinRequest,
  rejectJoinRequest,
  cancelJoinRequest,
  removeMember
};
