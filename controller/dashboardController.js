const moment = require("moment");
const { Salecart } = require("../model/saleCartSchema");
const Plan = require("../model/planSalerModel");
const Income = require("../model/Income");
const Material = require("../model/wherehouseModel");
const Balance = require("../model/balance");
const Debt = require("../model/debtSchema");
const Expense = require("../model/expenseModel");
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
            const salesDebts = await Salecart.find();
            const totalDebt = salesDebts.reduce((sum, sale) => sum + sale.payment.debt, 0);

            const calculateGrowth = (curr, prev) => {
                if (prev === 0) return 0;
                return ((curr - prev) / prev) * 100;
            };

            const expenses = await Expense.find({ date: { $gte: start, $lte: end } });
            const prevExpenses = await Expense.find({ date: { $gte: prevStart, $lte: prevEnd } });

            const incomeSum = expenses.filter(i => i.type === "kirim").reduce((sum, e) => sum + e.amount, 0);
            const expenseSum = expenses.filter(i => i.type === "chiqim").reduce((sum, e) => sum + e.amount, 0);
            const prevExpenseSum = prevExpenses.filter(i => i.type === "chiqim").reduce((sum, e) => sum + e.amount, 0);
            const prevIncomeSum = prevExpenses.filter(i => i.type === "kirim").reduce((sum, e) => sum + e.amount, 0);
            const netProfit = incomeSum - expenseSum;

            const incomeGrowth = calculateGrowth(incomeSum, prevIncomeSum);
            const expenseGrowth = calculateGrowth(expenseSum, prevExpenseSum);

            const rawMaterialTotal = await Material.aggregate([
                { $group: { _id: null, total: { $sum: { $multiply: ["$quantity", "$price"] } } } }
            ]);

            const finishedProductTotal = await FinishedProduct.aggregate([
                { $group: { _id: null, total: { $sum: { $multiply: ["$quantity", "$sellingPrice"] } } } }
            ]);

            const incomeDebs = await Income.find();
            const existingDebts = incomeDebs.filter(income => income.debt.remainingAmount > 0);

            // Calculate total remaining debt
            const totalRemainingDebt = existingDebts.reduce((sum, income) => sum + income.debt.remainingAmount, 0);

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
                const startOfDay = moment(dateStr).startOf("day").toDate();
                const endOfDay = moment(dateStr).endOf("day").toDate();

                // Filter expenses for the specific day and calculate income and expense
                const dailyExpenses = expenses.filter(e => moment(e.date).isBetween(startOfDay, endOfDay, null, '[]'));
                const dailyIncome = dailyExpenses.filter(i => i.type === "kirim").reduce((sum, e) => sum + e.amount, 0);
                const dailyExpense = dailyExpenses.filter(i => i.type === "chiqim").reduce((sum, e) => sum + e.amount, 0);

                dailyIncomeExpense.push({
                    day,
                    income: dailyIncome,
                    expense: dailyExpense,
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

            // const currentSales = await Salecart.find({ createdAt: { $gte: start, $lte: end } });

            const salesBySaler = {};
            currentSales.forEach((sale) => {
                const id = sale.salerId?.toString();
                if (!id) return;
                if (!salesBySaler[id]) salesBySaler[id] = { total: 0, count: 0 };
                salesBySaler[id].total += sale.payment.totalAmount;
                salesBySaler[id].count += 1;
            });

            const plans = await Plan.find({ createdAt: { $gte: start, $lte: end } }).populate("employeeId").populate("sales");


            const salerRatings = plans.map((plan) => {
                const sId = plan.employeeId?._id?.toString();


                // Shu xodimga tegishli va oy oralig'idagi sotuvlarni filtrlash
                const employeeSales = currentSales.filter((sale) => {
                    const saleDate = new Date(sale.createdAt);
                    return (
                        sale.salerId?.toString() === sId &&
                        saleDate >= start &&
                        saleDate <= end
                    );
                });
                // Shu xodimga tegishli umumiy summa
                const totalAmount = employeeSales.reduce(
                    (sum, sale) => sum + (sale.payment?.paidAmount || 0),
                    0
                );

                // const count = salesBySaler[sId]?.count || 0;

                const percent = plan.targetAmount > 0 ? Math.round((totalAmount / plan.targetAmount) * 100) : 0;
                return {
                    name: `${plan.employeeId.firstName} ${plan.employeeId.lastName}`,
                    percent,
                    target: plan.targetAmount,
                    current: totalAmount,
                    orders: employeeSales?.length,
                    avg: employeeSales?.length ? Math.round(totalAmount / employeeSales?.length) : 0,
                };
            });
            const borrowSum = await Debt.aggregate([{ $match: { type: "borrow", status: "active" } }, { $group: { _id: null, total: { $sum: "$remainingAmount" } } }]).then(r => r[0]?.total || 0);
            const lendSum = await Debt.aggregate([{ $match: { type: "lend", status: "active" } }, { $group: { _id: null, total: { $sum: "$remainingAmount" } } }]).then(r => r[0]?.total || 0)

            return response.success(res, "Dashboard data fetched", {
                period: { from: start, to: end },
                stats: {
                    balance: await Balance.getBalance(),
                    borrowSum: borrowSum + totalRemainingDebt,
                    lendSum: lendSum + totalDebt,
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


