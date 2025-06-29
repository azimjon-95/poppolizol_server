const router = require("express").Router();

// Controllers
const adminController = require("../controller/adminController");
const attendanceController = require("../controller/attendanceController");
const materialController = require("../controller/materialContoller");
const materialService = require("../controller/materialCtrl");
const normaController = require("../controller/normaController");
const productionSystem = require("../controller/ProductionSystemCtrl");
const factoryController = require("../controller/factoryConfigCtrl");
const ExpenseController = require('../controller/expensesController');
const SalaryService = require('../controller/SalaryCtrl');
// Validations
const adminValidation = require("../validation/adminValidation");
const materialValidation = require("../validation/MaterialValidation");
const normaValidation = require("../validation/normaValidation");

/**
 * ============================
 * Material Routes
 * ============================
 */
router.post("/material/create", materialValidation, materialController.create);
router.get("/material/all", materialController.getAll);
router.put("/material/update/:id", materialValidation, materialController.update);
router.delete("/material/delete/:id", materialController.delete);

router.post("/material/incomes", materialService.handleNewIncome);
router.post("/material/firms", materialService.createFirm);
router.get("/material/firms", materialService.getFirms);
router.get("/material/getincomes", materialService.getIncomes);
router.get("/material/filtered-materials", materialService.getFilteredMaterials);


/**
 * ============================
 * factory configuration
 * ============================
 */
router.post('/factory', factoryController.create);
router.get('/factory', factoryController.getAll);
router.get('/factory/:id', factoryController.getById);
router.put('/factory/:id', factoryController.update);
router.delete('/factory/:id', factoryController.delete);



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
 * Production System Routes
 * ============================
 */
router.get("/finished-products", productionSystem.finishedProducts);
router.get("/production-history", productionSystem.productionHistory);
router.post("/production-process", productionSystem.productionProcess);
router.post("/production/bn5", productionSystem.createBn5Production);

/**
 * ============================
 * Admin Routes
 * ============================
 */
router.post("/admin/login", adminController.login);
router.post("/admin/create", adminValidation, adminController.createEmployee);
router.get("/admin/all", adminController.getEmployees);
router.get("/admin/:id", adminController.getEmployeeById);
router.put("/admin/update/:id", adminValidation, adminController.updateEmployee);
router.delete("/admin/delete/:id", adminController.deleteEmployee);

/**
 * ============================
 * Attendance Routes (NFC)
 * ============================
 */
router.post("/nfc-scan", attendanceController.nfcScan);
router.post("/check-in", attendanceController.checkIn);
router.post("/check-out", attendanceController.checkOut);
router.get("/daily-report", attendanceController.getDailyReport);
router.get("/employee-history/:employee_id", attendanceController.getEmployeeHistory);

/**
 * ============================
 * Expense Routes
 * ============================
 */
router.post('/expense', ExpenseController.createExpense);
router.get('/expense', ExpenseController.getExpenses);
router.get('/balance', ExpenseController.getBalance);
router.put('/expense/:id', ExpenseController.updateExpense);
router.delete('/expense/:id', ExpenseController.deleteExpense);


/**
 * ============================
 * Salar Routes
 * ============================
 */
router.get('/employees/:month/:year', SalaryService.getAllEmployeesSalaryInfo);
router.get('/employee/:employeeId/:month/:year', SalaryService.getEmployeeSalaryInfo);
router.post('/pay', SalaryService.paySalary);
router.post('/penalty', SalaryService.addPenalty);
router.get('/report/:month/:year', SalaryService.getMonthlySalaryReport);
router.get('/penalties/:employeeId/:month/:year', SalaryService.getEmployeePenalties);
router.post('/overpayment', SalaryService.handleOverpayment);


module.exports = router;