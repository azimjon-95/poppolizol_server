const Expense = require('../model/expenseModel');
const Balance = require('../model/balance');
const response = require('../utils/response');

class ExpenseController {
  async createExpense(req, res) {
    try {
      const { relatedId, type, paymentMethod, category, amount, description, date } = req.body;

      if (!type || !paymentMethod || !category || !amount || !description) {
        return response.error(res, "Barcha maydonlarni to'ldiring!");
      }

      if (amount <= 0) {
        return response.error(res, "Summa 0 dan katta bo'lishi kerak!");
      }

      // Map payment methods from Expense to Balance
      const paymentMethodMap = {
        naqt: 'naqt',
        bank: 'bank',
      };
      const mappedPaymentMethod = paymentMethodMap[paymentMethod];
      if (!mappedPaymentMethod) {
        return response.error(res, "Noto'g'ri to'lov usuli!");
      }

      // Initialize balance if it doesn't exist
      await Balance.initializeBalance();

      // Update balance before saving expense to ensure sufficient funds for chiqim
      await Balance.updateBalance(mappedPaymentMethod, type, amount);

      const expense = new Expense({
        relatedId,
        type,
        paymentMethod,
        category,
        amount,
        description,
        date: date || new Date()
      });

      await expense.save();
      const populatedExpense = await Expense.findById(expense._id).populate('relatedId');
      return response.created(res, `${type === 'kirim' ? 'Kirim' : 'Chiqim'} muvaffaqiyatli qo'shildi!`, populatedExpense);
    } catch (error) {
      return response.serverError(res, 'Server xatosi', error.message);
    }
  }

  async getExpenses(req, res) {
    try {
      const { startDate, endDate } = req.query;
      let query = {};

      if (startDate && endDate) {
        query.date = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const expenses = await Expense.find(query).populate('relatedId').sort({ date: -1 });
      return response.success(res, 'Ma\'lumotlar muvaffaqiyatli olindi', expenses);
    } catch (error) {
      return response.serverError(res, 'Server xatosi', error.message);
    }
  }

  async updateExpense(req, res) {
    try {
      const { id } = req.params;
      const { type, paymentMethod, amount, ...otherUpdates } = req.body;

      // Map payment methods from Expense to Balance
      const paymentMethodMap = {
        naqt: 'naqt',
        bank: 'bank'
      };
      const mappedPaymentMethod = paymentMethodMap[paymentMethod];
      if (paymentMethod && !mappedPaymentMethod) {
        return response.error(res, "Noto'g'ri to'lov usuli!");
      }

      // Find the existing expense
      const existingExpense = await Expense.findOne({ relatedId: id });
      if (!existingExpense) {
        return response.notFound(res, 'Transaksiya topilmadi');
      }

      // Reverse the effect of the existing expense on balance
      const existingMappedPaymentMethod = paymentMethodMap[existingExpense.paymentMethod];
      await Balance.updateBalance(existingMappedPaymentMethod, existingExpense.type === 'kirim' ? 'chiqim' : 'kirim', existingExpense.amount);

      // Apply the new balance update if type, paymentMethod, or amount is provided
      if (type || paymentMethod || amount) {
        const newType = type || existingExpense.type;
        const newPaymentMethod = mappedPaymentMethod || existingMappedPaymentMethod;
        const newAmount = amount || existingExpense.amount;
        await Balance.updateBalance(newPaymentMethod, newType, newAmount);
      }

      const expense = await Expense.findOneAndUpdate(
        { relatedId: id },
        { $set: { type, paymentMethod, amount, ...otherUpdates } },
        { new: true, runValidators: true }
      ).populate('relatedId');

      if (!expense) {
        return response.notFound(res, 'Transaksiya topilmadi');
      }

      return response.success(res, 'Transaksiya muvaffaqiyatli yangilandi', expense);
    } catch (error) {
      return response.serverError(res, 'Server xatosi', error.message);
    }
  }

  async deleteExpense(req, res) {
    try {
      const { id } = req.params;
      const expense = await Expense.findOne({ _id: id });
      if (!expense) {
        return response.notFound(res, 'Transaksiya topilmadi');
      }

      // Map payment methods from Expense to Balance
      const paymentMethodMap = {
        naqt: 'naqt',
        bank: 'bank',
      };
      const mappedPaymentMethod = paymentMethodMap[expense.paymentMethod];
      if (!mappedPaymentMethod) {
        return response.error(res, "Noto'g'ri to'lov usuli!");
      }

      // Reverse the effect of the expense on balance
      await Balance.updateBalance(mappedPaymentMethod, expense.type === 'kirim' ? 'chiqim' : 'kirim', expense.amount);

      await Expense.findByIdAndDelete(id);

      return response.success(res, 'Transaksiya muvaffaqiyatli o\'chirildi');
    } catch (error) {
      return response.serverError(res, 'Server xatosi', error.message);
    }
  }

  async getBalance(req, res) {
    try {
      const balance = await Balance.getBalance();
      return response.success(res, 'Balans ma\'lumotlari muvaffaqiyatli olindi', balance);
    } catch (error) {
      return response.serverError(res, 'Server xatosi', error.message);
    }
  }
}

module.exports = new ExpenseController();