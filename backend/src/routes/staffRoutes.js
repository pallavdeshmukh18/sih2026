const express = require("express");
const router = express.Router();
const staffController = require("../controllers/staffController");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/rbacMiddleware");

// -------------------------------------------------------
// All routes below require a valid JWT token
// -------------------------------------------------------
router.use(authenticateToken);

/**
 * POST /api/doctor/staff/create
 * Doctor creates a staff account (admin, receptionist, nurse)
 */
router.post(
    "/create",
    authorizeRoles("doctor"),
    staffController.createStaffAccount
);

/**
 * GET /api/doctor/staff
 * Doctor retrieves all staff they have created
 */
router.get(
    "/",
    authorizeRoles("doctor"),
    staffController.getStaffList
);

/**
 * DELETE /api/doctor/staff/:staffId
 * Doctor soft-deletes (deactivates) a staff account
 */
router.delete(
    "/:staffId",
    authorizeRoles("doctor"),
    staffController.deleteStaffAccount
);

/**
 * PATCH /api/doctor/staff/:staffId/toggle
 * Doctor toggles a staff account active/inactive
 */
router.patch(
    "/:staffId/toggle",
    authorizeRoles("doctor"),
    staffController.toggleStaffStatus
);

module.exports = router;
