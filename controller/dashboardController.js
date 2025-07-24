const moment = require("moment");
const { Salecart } = require("../model/saleCartSchema");
const Plan = require("../model/planSalerModel");
const Income = require("../model/Income");
const Material = require("../model/wherehouseModel");
const Balance = require("../model/balance");
const Debt = require("../model/debtSchema");
const Expense = require("../model/expenseModel");
const ProductionHistory = require("../model/ProductionHistoryModel");
const FinishedProduct = require("../model/finishedProductModel"); // Assuming a FinishedProduct model exists
const response = require("../utils/response");



class DashboardController {

    async getMonthlyDashboard(req, res) {
        try {
            let { month } = req.query; // format: YYYY.MM


            const [year, monthIndex] = month.split("-").map(Number);
            const start = moment({ year, month: monthIndex - 1 }).startOf("month").toDate();
            const end = moment(start).endOf("month").toDate();

            const prevStart = moment(start).subtract(1, 'month').startOf('month').toDate();
            const prevEnd = moment(prevStart).endOf('month').toDate();

            const currentSales = await Salecart.find({ createdAt: { $gte: start, $lte: end } });
            const prevSales = await Salecart.find({ createdAt: { $gte: prevStart, $lte: prevEnd } });

            const calculateGrowth = (curr, prev) => {
                if (prev === 0) return 0;
                return ((curr - prev) / prev) * 100;
            };

            const expenses = await Expense.find({ date: { $gte: start, $lte: end } });
            const prevExpenses = await Expense.find({ date: { $gte: prevStart, $lte: prevEnd } });

            const incomeSum = currentSales.reduce((sum, s) => sum + s.payment.paidAmount, 0);
            const prevIncomeSum = prevSales.reduce((sum, s) => sum + s.payment.paidAmount, 0);
            const expenseSum = expenses.reduce((sum, e) => sum + e.amount, 0);
            const prevExpenseSum = prevExpenses.reduce((sum, e) => sum + e.amount, 0);
            const netProfit = incomeSum - expenseSum;

            const incomeGrowth = calculateGrowth(incomeSum, prevIncomeSum);
            const expenseGrowth = calculateGrowth(expenseSum, prevExpenseSum);

            const rawMaterialTotal = await Material.aggregate([
                { $group: { _id: null, total: { $sum: { $multiply: ["$quantity", "$price"] } } } }
            ]);

            const finishedProductTotal = await FinishedProduct.aggregate([
                { $group: { _id: null, total: { $sum: { $multiply: ["$quantity", "$sellingPrice"] } } } }
            ]);

            const incomeNds = await Income.aggregate([
                { $match: { date: { $gte: start, $lte: end } } },
                { $group: { _id: null, total: { $sum: "$vatAmount" } } }
            ]);

            let totalIncomeVat = incomeNds.length > 0 ? incomeNds[0].total : 0;
            const saleNds = currentSales.reduce((sum, sale) => sum + (sale.payment.ndsTotal || 0), 0);
            const totalVat = totalIncomeVat + saleNds;

            const paymentTypes = { naqt: 0, bank: 0 };
            currentSales.forEach((sale) => {
                if (sale.payment.paymentType in paymentTypes) {
                    paymentTypes[sale.payment.paymentType] += sale.payment.paidAmount;
                }
            });
            const totalPayment = paymentTypes.naqt + paymentTypes.bank;

            const paymentTypeBreakdown = {
                naqt: paymentTypes.naqt,
                bank: paymentTypes.bank,
                percent: {
                    naqt: totalPayment ? (paymentTypes.naqt * 100) / totalPayment : 0,
                    bank: totalPayment ? (paymentTypes.bank * 100) / totalPayment : 0,
                },
            };

            const incomeMap = {};
            const expenseMap = {};

            currentSales.forEach((s) => {
                const d = moment(s.createdAt).format("YYYY-MM-DD");
                incomeMap[d] = (incomeMap[d] || 0) + s.payment.paidAmount;
            });

            expenses.forEach((e) => {
                const d = moment(e.date).format("YYYY-MM-DD");
                expenseMap[d] = (expenseMap[d] || 0) + e.amount;
            });

            const daysInMonth = moment(start).daysInMonth();
            const dailyIncomeExpense = [];
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = moment(start).date(day).format("YYYY-MM-DD");
                incomeMap[dateStr] = incomeMap[dateStr] || 0;
                expenseMap[dateStr] = expenseMap[dateStr] || 0;
                dailyIncomeExpense.push({
                    day,
                    income: incomeMap[dateStr],
                    expense: expenseMap[dateStr],
                });
            }

            const prevIncomeMap = {};
            prevSales.forEach((s) => {
                const d = moment(s.createdAt).format("YYYY-MM-DD");
                prevIncomeMap[d] = (prevIncomeMap[d] || 0) + s.payment.paidAmount;
            });

            const dailySalesComparison = [];
            for (let day = 1; day <= daysInMonth; day++) {
                const currDate = moment(start).date(day).format("YYYY-MM-DD");
                const prevDate = moment(prevStart).date(day).format("YYYY-MM-DD");
                dailySalesComparison.push({
                    day,
                    current: incomeMap[currDate] || 0,
                    previous: prevIncomeMap[prevDate] || 0
                });
            }

            const plans = await Plan.find({ createdAt: { $gte: start, $lte: end } }).populate("employeeId").populate("sales");
            const salesBySaler = {};
            currentSales.forEach((sale) => {
                const id = sale.salerId?.toString();
                if (!id) return;
                if (!salesBySaler[id]) salesBySaler[id] = { total: 0, count: 0 };
                salesBySaler[id].total += sale.payment.totalAmount;
                salesBySaler[id].count += 1;
            });

            const salerRatings = plans.map((plan) => {
                const sId = plan.employeeId?._id?.toString();
                const actual = salesBySaler[sId]?.total || 0;
                const count = salesBySaler[sId]?.count || 0;
                const percent = plan.targetAmount > 0 ? Math.round((actual / plan.targetAmount) * 100) : 0;
                return {
                    name: `${plan.employeeId.firstName} ${plan.employeeId.lastName}`,
                    percent,
                    target: plan.targetAmount,
                    current: actual,
                    orders: count,
                    avg: count ? Math.round(actual / count) : 0,
                };
            });

            return response.success(res, "Dashboard data fetched", {
                period: { from: start, to: end },
                stats: {
                    balance: await Balance.getBalance(),
                    lendSum: await Debt.aggregate([{ $match: { type: "lend", status: "active" } }, { $group: { _id: null, total: { $sum: "$remainingAmount" } } }]).then(r => r[0]?.total || 0),
                    borrowSum: await Debt.aggregate([{ $match: { type: "borrow", status: "active" } }, { $group: { _id: null, total: { $sum: "$remainingAmount" } } }]).then(r => r[0]?.total || 0),
                    warehouseValue: rawMaterialTotal[0]?.total || 0,
                    finishedProductValue: finishedProductTotal[0]?.total || 0,
                    income: incomeSum,
                    expense: expenseSum,
                    incomeGrowth,
                    expenseGrowth,
                    netProfit,
                },
                vatReport: {
                    fromIncome: totalIncomeVat,
                    fromSales: saleNds,
                    percent: {
                        fromIncome: totalVat ? (totalIncomeVat * 100) / totalVat : 0,
                        fromSales: totalVat ? (saleNds * 100) / totalVat : 0,
                    },
                },
                paymentTypeBreakdown,
                dailyIncomeExpense,
                dailySalesComparison,
                salerRatings,
            });
        } catch (error) {
            console.error("Dashboard error:", error);
            return response.serverError(res, "Server error", error);
        }
    }

}

module.exports = new DashboardController();


