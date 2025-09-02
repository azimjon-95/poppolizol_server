const router = require("express").Router();

// Controllers
const adminController = require("../controller/adminController");
const attendanceController = require("../controller/attendanceController");
const materialController = require("../controller/materialContoller");
const materialService = require("../controller/materialCtrl");
const PraymerController = require("../controller/praymer.controller");
const normaController = require("../controller/normaController");
const productionSystem = require("../controller/ProductionSystemCtrl");
const factoryController = require("../controller/factoryConfigCtrl");
const ExpenseController = require("../controller/expensesController");
const SalaryService = require("../controller/SalaryCtrl");
const SalesController = require("../controller/planSalerController");
const CategoryProductController = require("../controller/catigory.controller");
const SaleController = require("../controller/saleCartController"); // Path to your SaleController
const salaryController = require("../controller/calculateSalary/salaryController");
const AdditionExpenController = require("../controller/additionExpen.controller");
const FirmService = require("../controller/firmaCtrl");
// Validations
const adminValidation = require("../validation/adminValidation");
const materialValidation = require("../validation/MaterialValidation");
const normaValidation = require("../validation/normaValidation");
const DebtController = require("../controller/debtController");
const DashboardController = require("../controller/dashboardController");

const bonusController = require("../controller/bonusController");
const bonusValidation = require("../validation/bonusValidation");

router.post("/bonus/create", bonusValidation, bonusController.create);
router.get("/bonus/all", bonusController.getAll);
router.get("/bonus/:id", bonusController.getById);
router.put("/bonus/update/:id", bonusController.update);
router.delete("/bonus/delete/:id", bonusController.delete);

router.get("/salary/getAll", salaryController.getAll);
router.get("/salary/getBTM3", salaryController.getSalariesBTM3);

// attendance routes
router.post("/attendance", attendanceController.markAttendance);
router.get("/attendance", attendanceController.getAttendanceHistory);
router.get("/attendance/all", attendanceController.getAllAttendanceByDateRange);
router.put("/attendance", attendanceController.updateAttendance);
router.delete("/attendance", attendanceController.deleteAttendance);
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

router.post("/material/incomes", materialService.handleNewIncome);
router.post("/material/firms", materialService.createFirm);
router.get("/material/firms", materialService.getFirms);
router.get("/material/getincomes", materialService.getIncomes);

// Route to handle debt payment
router.post("/material/paydebtincome", materialService.payDebtIncom);
router.get(
  "/material/filtered-materials",
  materialService.getFilteredMaterials
);

/**
 * ============================
 * factory configuration
 * ============================
 */
router.post("/factory", factoryController.create);
router.get("/factory", factoryController.getAll);
router.get("/factory/:id", factoryController.getById);
router.put("/factory/:id", factoryController.update);
router.delete("/factory/:id", factoryController.delete);

/**
 * ============================
 * Norma Routes
 * ============================
 */
router.post("/norma/create", normaController.createNorma);
router.get("/norma/all", normaController.getNorma);
router.put("/norma/update/:id", normaController.updateNorma);
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
router.post("/production/salesBN5", productionSystem.productionForSalesBN5);
router.get("/inventory", productionSystem.getInventory);
router.put("/finished-products/:id", productionSystem.updateFinished);
router.delete("/finished-products/:id", productionSystem.deleteFinished);

/**
 * ============================
 * Admin Routes
 * ============================
 */
router.post("/admin/login", adminController.login);
router.post("/admin/pin", adminController.loginUnitHead);
router.post("/admin/create", adminValidation, adminController.createEmployee);
router.get("/admin/all", adminController.getEmployees);
router.get("/admin/:id", adminController.getEmployeeById);
router.get("/Okisleniya", adminController.OkisleniyaEmployees);
router.get("/productionEmployees", adminController.getProductionEmployees);
router.put(
  "/admin/update/:id",
  adminValidation,
  adminController.updateEmployee
);
router.delete("/admin/delete/:id", adminController.deleteEmployee);

/**
 * ============================
 * Expense Routes
 * ============================
 */
router.get("/getreports", ExpenseController.getReports);
router.post("/expense", ExpenseController.createExpense);
router.get("/expense", ExpenseController.getExpenses);
router.get("/balance", ExpenseController.getBalance);
router.put("/expense/:id", ExpenseController.updateExpense);
router.delete("/expense/:id", ExpenseController.deleteExpense);

/**
 * ============================
 * Salar Routes
 * ============================
 */
router.get("/employees/:month/:year", SalaryService.getAllEmployeesSalaryInfo);
router.get(
  "/employee/:employeeId/:month/:year",
  SalaryService.getEmployeeSalaryInfo
);
router.post("/pay", SalaryService.paySalary);
router.post("/penalty", SalaryService.addPenalty);
router.get("/report/:month/:year", SalaryService.getMonthlySalaryReport);
router.get(
  "/penalties/:employeeId/:month/:year",
  SalaryService.getEmployeePenalties
);
router.post("/overpayment", SalaryService.handleOverpayment);
// getEmployeeFinanceHistory
router.get(
  "/finance-history/:employeeId",
  SalaryService.getEmployeeFinanceHistory
);
/**
 * ============================
 * Salar Cart Routes
 * ============================
 */

router.post("/sales", SaleController.createSale);
router.get("/sales/:id", SaleController.getSaleById);
router.put("/sales/:id", SaleController.updateSale);
router.delete("/sales/:id", SaleController.deleteSale);
router.post("/sales/pay-debt", SaleController.payDebt);
router.get("/filtered", SaleController.getFilteredSales);
router.post("/sales/:id/return", SaleController.returnItems);
router.get("/sales/customer", SaleController.getCustomerSales);
router.get("/companys", SaleController.getCompanys);
router.get(
  "/sales/customer/:customerId/completed",
  SaleController.getCustomerCompletedSales
);
router.get(
  "/sales/customer/:customerId/active",
  SaleController.getCustomerActiveSales
);
router.get("/transports", SaleController.getTransport);
router.post("/deliver", SaleController.deliverProduct);

/**
 * ============================
 * Plan Salas Routes
 * ============================
 */
router.get("/sales-employees", SalesController.getSalesEmployees);
router.post("/plans", SalesController.createPlan);
router.get("/plans", SalesController.getAllPlans);
router.get("/plans/:id", SalesController.getPlanById);
router.put("/plans/:id", SalesController.updatePlan);
router.delete("/plans/:id", SalesController.deletePlan);

/**
 * ============================
 * Debt Routes
 * ============================
 */
router.post("/debts", DebtController.createDebt);
router.post("/debts/repay", DebtController.repayDebt);
router.get("/debts/active", DebtController.getActiveDebts);
router.get("/debts/history", DebtController.getDebtHistory);

/**
 * ============================
 *  Dashboard Routes
 * ============================
 */
router.get("/dashboard", DashboardController.getMonthlyDashboard);

/**
 * ============================
 *  Category Routes
 * ============================
 */
router.post("/category", CategoryProductController.create);
router.get("/category", CategoryProductController.getAll);
router.get("/category/:id", CategoryProductController.getById);
router.put("/category/:id", CategoryProductController.update);
router.delete("/category/:id", CategoryProductController.delete);

/**
 * ============================
 *  AdditionExpen Routes
 * ============================
 */
router.post("/addition/expen", AdditionExpenController.create);
router.get("/addition/expen", AdditionExpenController.getAll);
router.get("/addition/expen/:id", AdditionExpenController.getById);
router.put("/addition/expen/:id", AdditionExpenController.update);
router.delete("/addition/expen/:id", AdditionExpenController.delete);

/**
 * ============================
 * Firm Routes
 * ============================
 */
router.post("/process-payment", FirmService.processCompanyPayment);

/**
 * ============================
 * Firm Praymer
 * ============================
 */
router.post("/praymer/", PraymerController.createProduction);
router.get("/praymer/", PraymerController.getAllProductions);
router.get("/praymer/:id", PraymerController.getProductionById);
router.put("/praymer/:id", PraymerController.updateProduction);
router.delete("/praymer/:id", PraymerController.deleteProduction);
router.get(
  "/praymer/monthly/:startDate/:endDate",
  PraymerController.getOneMonthData
); // Example: /monthly?month=8&year=2025

module.exports = router;
