const router = require("express").Router();

// Controllers and Validations
const adminController = require("../controller/adminController");
const adminValidation = require("../validation/adminValidation");
const AttendanceController = require("../controller/attendanceController");
const patientController = require("../controller/patientController");
const storyController = require("../controller/storyController");
const ClinicInfoController = require("../controller/clinicInfoController");
const clinicInfoValidation = require("../validation/clinicInfoValidation");
const roomController = require("../controller/roomController");
const roomValidation = require("../validation/roomValidation");
const expenseController = require("../controller/expensesController");
const expenseValidation = require("../validation/expensesValidation");
const dashboardController = require("../controller/dashboardController");
const servicesController = require("../controller/services-crud");
const NightShiftController = require("../controller/nightShiftController");

const materialController = require("../controller/materialContoller");
const materialValidation = require("../validation/MaterialValidation");

const normaController = require("../controller/normaController");
const normaValidation = require("../validation/normaValidation");

/**
 * ============================
 * Material Routes
 * ============================
 */
router.post("/material/create", materialValidation, materialController.create);
router.get("/material/all", materialController.getAll);
router.put(
  "/material/update/:id",
  materialValidation,
  materialController.update
);
router.delete("/material/delete/:id", materialController.delete);

/**
 * ============================
 * Norma Routes
 * ============================
 */
router.post("/norma/create", normaValidation, normaController.createNorma);
router.get("/norma/all", normaController.getNorma);
router.put("/norma/update/:id", normaValidation, normaController.updateNorma);
router.delete("/norma/delete/:id", normaController.deleteNorma);

/**
 * ============================
 * Admin Routes
 * ============================
 */
router.post("/admin/login", adminController.login);
router.get("/admin/all", adminController.getAdmins);
router.get("/admin/for_reception", adminController.getAdminsForReception);
router.get("/admin/:id", adminController.getAdminById);
router.post("/admin/create", adminValidation, adminController.createAdmin);
router.put("/admin/update/:id", adminValidation, adminController.updateAdmin);
router.delete("/admin/delete/:id", adminController.deleteAdmin);
router.put("/admin/:id/servicesId", adminController.updateServicesId);
router.put("/admins/:adminId/room", adminController.updateRoomId);

/**
 * ============================
 * Attendance Routes (NFC)
 * ============================
 */
router.post("/nfc-scan", AttendanceController.nfcScan);
router.post("/check-in", AttendanceController.checkIn);
router.post("/check-out", AttendanceController.checkOut);
router.get("/daily-report", AttendanceController.getDailyReport);
router.get(
  "/employee-history/:employee_id",
  AttendanceController.getEmployeeHistory
);

/**
 * ============================
 * Patient (Client) Routes
 * ============================
 */
router.post("/client/create", patientController.createPatient);
router.get("/client/all", patientController.getPatients);
router.get("/client/:id", patientController.getPatientById);
router.put("/client/update/:id", patientController.updatePatient);
router.delete("/client/delete/:id", patientController.deletePatient);

/**
 * ============================
 * Story Routes
 * ============================
 */
router.get("/story/all", storyController.getStory);
router.get("/story/patient/:id", storyController.getStoryByPatientId);
router.get("/story/doctor/:id", storyController.getStoryByDoctorId);
router.put("/story/update/:id", storyController.updateStory);
router.get("/story/todays", storyController.getTodaysStory);

/**
 * ============================
 * Clinic Info Routes
 * ============================
 */
router.post(
  "/clinic/create",
  clinicInfoValidation,
  ClinicInfoController.createClinicInfo
);
router.put("/clinic/update/:id", ClinicInfoController.updateClinicInfo);
router.get("/clinic/info", ClinicInfoController.getClinicInfo);

/**
 * ============================
 * Room Routes
 * ============================
 */
router.post("/room/create", roomValidation, roomController.createRoom);
router.get("/room/all", roomController.getRooms);
router.get("/room/stories", roomController.getRoomStories);
router.get("/room/:id", roomController.getRoomById);
router.put("/room/update/:id", roomController.updateRoom);
router.put("/roomStatus/update/:id", roomController.updateRoomCleanStatus);
router.delete("/room/delete/:id", roomController.deleteRoom);
router.patch("/room/closeRoom/:id", roomController.closeRoom);
router.patch("/room/addPatient/:id", roomController.addPatientToRoom);
router.post("/room/removePatient/:id", roomController.removePatientFromRoom);
router.post("/room/pay", roomController.payForRoom);
router.patch("/roomStory/changeDays", roomController.changeTreatingDays);

/**
 * ============================
 * Expense Routes
 * ============================
 */
router.post(
  "/expense/create",
  expenseValidation,
  expenseController.createExpense
);
router.get("/expense/all", expenseController.getExpenses);

/**
 * ============================
 * Dashboard Routes
 * ============================
 */
router.get("/dashboard", dashboardController.getDashboard);

/**
 * ============================
 * Services Routes
 * ============================
 */
router.post("/services", servicesController.create);
router.get("/services", servicesController.getAll);
router.get("/services/:id", servicesController.getById);
router.put("/services/:id", servicesController.update);
router.delete("/services/:id", servicesController.delete);
router.post("/services/:id/add", servicesController.addService);
router.delete("/services/:id/remove", servicesController.deleteService);

/**
 * ============================
 * Nurse night shifts
 * ============================
 */
router.get("/nurses", NightShiftController.getNurses);
router.get("/night-shifts", NightShiftController.getNightShifts);
router.post("/night-shifts", NightShiftController.createNightShift);
router.put("/night-shifts/:id", NightShiftController.updateNightShift);
router.delete("/night-shifts/:id", NightShiftController.deleteNightShift);
router.delete(
  "/night-shifts/:id/nurses/:nurseId",
  NightShiftController.removeNurseFromShift
);
router.post("/night-shifts/:id/start", NightShiftController.startShift);
router.post("/night-shifts/:id/end", NightShiftController.endShift);
router.post(
  "/night-shifts/auto-schedule",
  NightShiftController.autoScheduleShifts
);
router.post("/shift-reports", NightShiftController.createShiftReport);
router.get("/shift-reports", NightShiftController.getShiftReports);
router.get("/statistics/shifts", NightShiftController.getShiftStatistics);
router.get(
  "/statistics/nurse-earnings/:nurseId",
  NightShiftController.getNurseEarnings
);
router.get("/statistics/reports", NightShiftController.getNurseReports);

module.exports = router;
