const Expense = require('../model/expenseModel');
const ProductionHistory = require('../model/ProductionHistoryModel');
const Inventory = require('../model/inventoryHistoryModel');
const Praymer = require('../model/praymer');
const Balance = require('../model/balance');
const response = require('../utils/response');
const mongoose = require('mongoose');

class ExpenseController {

  async getReports(req, res) {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return response.badRequest(res, 'startDate and endDate are required');
      }

      const dateFilter = { $gte: new Date(startDate), $lte: new Date(endDate) };

      // Fetch data in parallel
      const [expenses, productionHistory, inventory, praymer] = await Promise.all([
        Expense.find({ date: dateFilter }),
        ProductionHistory.find({ createdAt: dateFilter }),
        Inventory.find({ createdAt: dateFilter }),
        Praymer.find({ createdAt: dateFilter }),
      ]);

      // Process expenses
      const { filteredExpenses, expensesRecord } = expenses.reduce(
        (acc, expense) => {
          if (expense.type === 'chiqim' && expense.category !== 'Sof foyda') {
            acc.filteredExpenses.push(expense);
          } else if (expense.category === 'Sof foyda') {
            acc.expensesRecord.push(expense);
          }
          return acc;
        },
        { filteredExpenses: [], expensesRecord: [] }
      );

      // Aggregate expenses by category
      const totalByCategory = filteredExpenses.reduce((acc, { category, amount }) => {
        acc[category] = (acc[category] || 0) + amount;
        return acc;
      }, {});

      const totalAmount = Object.values(totalByCategory).reduce((sum, amount) => sum + amount, 0);

      // Aggregate profit records
      const totalByRecord = expensesRecord.reduce((acc, { description, amount }) => {
        acc[description] = (acc[description] || 0) + amount;
        return acc;
      }, {});

      const resultArray = Object.entries(totalByRecord).map(([category, amount]) => ({
        category,
        amount,
      }));

      const resultAmount = resultArray.reduce((sum, { amount }) => sum + amount, 0);

      // Process production history
      const groupByProductName = (items) =>
        Object.values(
          items.reduce((acc, item) => {
            const key = item.productName;
            acc[key] = acc[key] || {
              productName: key,
              quantityProduced: 0,
              gasAmount: 0,
              electricity: 0,
              salePrice: item.salePrice,
            };
            acc[key].quantityProduced += item.quantityProduced || 0;
            acc[key].gasAmount += item.gasAmount || 0;
            acc[key].electricity += item.electricity || 0;
            return acc;
          }, {})
        );

      const products = {
        polizol: { name: 'Polizol', quantity: 0, gas: 0, electricity: 0, marketType: 'tashqi', sellingPrice: 0, items: [] },
        ruberoid: { name: 'Ruberoid', quantity: 0, gas: 0, electricity: 0, marketType: 'tashqi', sellingPrice: 0, items: [] },
      };

      const productItems = { polizol: [], ruberoid: [] };
      productionHistory.forEach((item) => {
        const name = item.productName.toLowerCase();
        const product = name.startsWith('palizol') || name.startsWith('polizol') ? products.polizol : name.includes('ruberoid') ? products.ruberoid : null;
        if (product) {
          product.quantity += item.quantityProduced || 0;
          product.gas += item.gasAmount || 0;
          product.electricity += item.electricity || 0;
          product.sellingPrice += item.salePrice || 0;
          productItems[product === products.polizol ? 'polizol' : 'ruberoid'].push(item);
        }
      });

      products.polizol.items = groupByProductName(productItems.polizol);
      products.ruberoid.items = groupByProductName(productItems.ruberoid);
      const consolidatedProductionHistory = Object.values(products).filter((p) => p.quantity > 0);

      // Process inventory
      const inventoryItems = {
        bn5: { name: 'BN-5', quantity: 0, melQuantity: 0, gas: 0, electricity: 0, sellingPrice: 0 },
        bn5Mel: { name: 'BN-5 (20% mel)', quantity: 0, melQuantity: 0, gas: 0, electricity: 0, sellingPrice: 0 },
      };

      inventory.forEach((item) => {
        const target = item.productionName === 'BN-5' ? inventoryItems.bn5 : item.productionName === 'BN-5 + Mel' ? inventoryItems.bn5Mel : null;
        if (target) {
          target.quantity += item.bn5Amount || 0;
          target.melQuantity += item.melAmount || 0;
          target.gas += item.gasAmount || 0;
          target.electricity += item.electricity || 0;
          target.sellingPrice = item.price || item.sellingPrice || 0;
        }
      });

      const consolidatedInventory = Object.values(inventoryItems).filter((i) => i.quantity > 0 || i.melQuantity > 0);

      // =============================
      // Process inventory
      const praymerItems = {
        praymer: { name: 'Praymer - BIPRO', quantity: 0, melQuantity: 0, gas: 0, electricity: 0, sellingPrice: 0 },
      };

      praymer.forEach((item) => {
        const target = item.productionName === 'Praymer - BIPRO' ? praymerItems.praymer : null
        if (target) {
          target.quantity += item.productionQuantity || 0;
          target.melQuantity += item.melAmount || 0;
          target.gas += item.gasAmount || 0;
          target.electricity += item.electricity || 0;
          target.sellingPrice = item.salePricePerBucket || 0;
        }
      });

      const praymerInventory = Object.values(praymerItems).filter((i) => i.quantity > 0 || i.melQuantity > 0);
      // =============================


      // Calculate totals and percentages
      const calcTotal = (arr) => arr.reduce((sum, item) => sum + item.quantity * item.sellingPrice, 0);
      const totalProduction = calcTotal(consolidatedProductionHistory);
      const totalInventory = calcTotal(consolidatedInventory);
      const totalPraymer = calcTotal(praymerInventory);
      const grandTotal = totalProduction + totalInventory + totalPraymer;
      const profit = grandTotal - totalAmount;
      const totalWithProfit = totalAmount + profit;
      const profitPercentage = totalWithProfit > 0 ? (profit / totalWithProfit) * 100 : 0;
      const expensePercentage = 100 - profitPercentage;


      // Format output
      const formattedOutput = Object.entries(totalByCategory).map(([category, amount]) => ({
        category,
        percentage: ((amount / totalAmount) * expensePercentage).toFixed(1),
        amount,
      }));

      const profitAmount = profit - resultAmount;
      const percentages = resultArray.map(({ category, amount }) => ({
        category,
        percentage: ((amount / profitAmount) * 100).toFixed(1),
        amount,
      }));

      // Construct final output
      formattedOutput.push(
        { category: 'Jami xarajatlar', percentage: expensePercentage.toFixed(1), amount: totalAmount, isSubtotal: true },
        { category: '', percentage: '', amount: '', isNote: true },
        { category: 'Foyda', percentage: profitPercentage.toFixed(1), amount: profit, isProfit: true },
        { category: 'Shundan:', percentage: '', amount: '', isNote: true },
        ...percentages,
        { category: 'Jami daromad:', percentage: '', amount: '', price: 0, isTotal: true }
      );

      return response.success(res, 'Data retrieved successfully', {
        expenses: formattedOutput,
        productionHistory: consolidatedProductionHistory,
        inventory: consolidatedInventory,
        praymer: praymerInventory
      });
    } catch (error) {
      return response.serverError(res, 'Server error', error.message);
    }
  }

  async createExpense(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { relatedId, type, paymentMethod, category, amount, description, date } = req.body;

      // Validate required fields
      if (!type || !paymentMethod || !category || !amount || !description) {
        await session.abortTransaction();
        session.endSession();
        return response.error(res, "Barcha maydonlarni to'ldiring!");
      }

      // Validate type
      if (!['kirim', 'chiqim'].includes(type)) {
        await session.abortTransaction();
        session.endSession();
        return response.error(res, "Noto'g'ri tur: kirim yoki chiqim bo'lishi kerak!");
      }

      // Validate amount
      if (amount <= 0) {
        await session.abortTransaction();
        session.endSession();
        return response.error(res, "Summa 0 dan katta bo'lishi kerak!");
      }

      // Map payment methods
      const paymentMethodMap = {
        naqt: 'naqt',
        bank: 'bank',
      };
      const mappedPaymentMethod = paymentMethodMap[paymentMethod];
      if (!mappedPaymentMethod) {
        await session.abortTransaction();
        session.endSession();
        return response.error(res, "Noto'g'ri to'lov usuli!");
      }

      // Initialize balance if it doesn't exist
      await Balance.initializeBalance(session);

      // Update balance (add for kirim, subtract for chiqim)
      await Balance.updateBalance(mappedPaymentMethod, type, amount, session);

      // Create and save expense
      const expense = new Expense({
        relatedId,
        type,
        paymentMethod,
        category,
        amount,
        description,
        date: date || new Date(),
      });

      await expense.save({ session });

      // Populate relatedId
      const populatedExpense = await Expense.findById(expense._id)
        .session(session)
        .populate('relatedId');

      await session.commitTransaction();
      session.endSession();

      return response.created(
        res,
        `${type === 'kirim' ? 'Kirim' : 'Chiqim'} muvaffaqiyatli qo'shildi!`,
        populatedExpense
      );
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
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