const Expense = require("../model/expenseModel");
const response = require("../utils/response");

class ExpensesController {
  async createExpense(req, res) {
    try {
      const expense = await Expense.create(req.body);
      if (!expense) return response.notFound(res, "Xarajat qo'shilmadi");
      return response.success(res, "Xarajat qo'shildi", expense);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  async getExpenses(req, res) {
    try {
      let filter = {};
      let startDate, endDate;

      if (req.query.startDate && req.query.endDate) {
        // startDate va endDate bo'lsa, shu oraliqni olamiz
        startDate = new Date(req.query.startDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(req.query.endDate);
        endDate.setHours(23, 59, 59, 999);
      } else {
        // Aks holda, joriy oyning boshidan oxirigacha
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        );
      }

      filter.createdAt = { $gte: startDate, $lte: endDate };

      const expenses = await Expense.find(filter).sort({ createdAt: -1 });
      if (!expenses.length)
        return response.notFound(res, "Xarajatlar topilmadi");
      return response.success(res, "Xarajatlar ro'yxati", expenses);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }
}

module.exports = new ExpensesController();
