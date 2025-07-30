const { Salecart, Customer } = require("../model/saleCartSchema");
const Expense = require("../model/expenseModel");
const Balance = require("../model/balance");
const Employee = require("../model/adminModel");
const Plan = require("../model/planSalerModel");
const FinishedProduct = require("../model/finishedProductModel");
const response = require("../utils/response");
const Transport = require("../model/transportModel");
const mongoose = require("mongoose");
const moment = require("moment");
const SalaryRecord = require("../model/salaryRecord");
const Attendance = require("../model/attendanceModal");

class SaleController {
  async createSale(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        customer: customerData,
        customerType,
        transport,
        salerId,
        items,
        payment,
      } = req.body;

      if (!customerData || !salerId || !items || !payment) {
        await session.abortTransaction();
        return response.error(res, "Barcha maydonlar to'ldirilishi shart");
      }

      if (!customerData.name) {
        await session.abortTransaction();
        return response.error(res, "Mijoz ismi kiritilishi shart");
      }

      if (payment.totalAmount < payment.paidAmount) {
        await session.abortTransaction();
        return response.error(
          res,
          "To'lov summasi yakuniy summadan oshib ketdi!"
        );
      }

      if (payment.paidAmount > 0 && !payment.paymentType) {
        await session.abortTransaction();
        return response.error(res, "To'lov turi kiritilmadi!");
      }

      // Verify saler exists
      const employee = await Employee.findById(salerId).session(session);
      if (!employee) {
        await session.abortTransaction();
        return response.notFound(res, "Sotuvchi topilmadi");
      }

      // Find or create customer
      let customer = await Customer.findOne({
        $or: [
          { phone: customerData.phone || "" },
          { name: customerData.name, type: customerData.type || "individual" },
        ],
      }).session(session);

      if (!customer) {
        customer = new Customer({
          name: customerData.name,
          phone: customerData.phone || "",
          type: customerData.type || "individual",
          companyAddress:
            customerData.type === "company"
              ? customerData.companyAddress
              : undefined,
        });
        await customer.save({ session });
      }

      // Handle transport
      if (transport) {
        let transportRecord = await Transport.findOne({ transport }).session(
          session
        );
        if (!transportRecord) {
          transportRecord = new Transport({
            transport,
            balance: payment.transportCost || 0,
          });
        } else {
          transportRecord.balance += payment.transportCost || 0;
        }
        await transportRecord.save({ session });
      }

      // Get current month for plan based on current date
      const currentDate = new Date();
      const month = `${currentDate.getFullYear()}.${String(
        currentDate.getMonth() + 1
      ).padStart(2, "0")}`;

      // Find plan for current month
      const plan = await Plan.findOne({
        employeeId: salerId,
        month,
      }).session(session);

      if (!plan) {
        await session.abortTransaction();
        return response.notFound(
          res,
          `Sotuvchi uchun ${month} oyida plan topilmadi`
        );
      }

      // Validate items and add productId
      for (const item of items) {
        const product = await FinishedProduct.findById(item._id).session(
          session
        );
        if (!product) {
          await session.abortTransaction();
          return response.notFound(
            res,
            `Maxsulot topilmadi: ${item.productName}`
          );
        }
        item.productId = item._id; // Add productId to item
      }

      // Create new sale
      const newSale = new Salecart({
        customerId: customer._id,
        salerId,
        items,
        payment,
        customerType,
        salesperson: `${employee.firstName} ${employee.lastName}`,
        date: new Date().toLocaleDateString("uz-UZ"),
        time: new Date().toLocaleTimeString("uz-UZ"),
        transport: transport || "",
        isContract: req.body.isContract ?? true,
        deliveryDate: req.body.deliveryDate || null,
      });

      // Update balance if there's a payment
      if (payment.paidAmount > 0) {
        const balanceField = payment.paymentType === "naqt" ? "naqt" : "bank";
        await Balance.updateBalance(balanceField, "kirim", payment.paidAmount, {
          session,
        });

        // Update plan based on paid amount
        plan.achievedAmount += payment.paidAmount;
        plan.progress = Math.min(
          (plan.achievedAmount / plan.targetAmount) * 100,
          100
        );
        await plan.save({ session });
      }

      // Save sale
      const savedSale = await newSale.save({ session });

      // Add sale to plan's sales array
      plan.sales.push(savedSale._id);
      await plan.save({ session });

      await session.commitTransaction();

      // Populate data in response
      const populatedSale = await Salecart.findById(savedSale._id)
        .populate("customerId", "name type phone companyAddress")
        .populate("salerId", "firstName lastName")
        .lean();

      // -----------------------------------------------------------------
      let today = new Date();
      today.setHours(0, 0, 0, 0); // Faqat sana

      // 1. Bugungi SalaryRecord ni topish
      let salaryRecord = await SalaryRecord.findOne({
        date: {
          $gte: new Date(today),
          $lte: new Date(today.getTime() + 86399999), // 23:59:59
        },
        department: "polizol",
      });

      // 2. Yuklangan mahsulotlar hisoblash
      const loadedCount = items.reduce((acc, i) => acc + i.quantity, 0);
      const loadAmount = loadedCount * 400;

      // 3. Agar mavjud bo‘lmasa — yangi SalaryRecord yaratish (faqat yuklash uchun)
      if (!salaryRecord) {
        // Ehtimol, hali ishlab chiqarilmagan, faqat yuklangan
        const emptyAttendances = await Attendance.find({
          date: {
            $gte: new Date(today),
            $lte: new Date(today.getTime() + 86399999),
          },
          unit: "polizol",
        });

        if (emptyAttendances.length === 0) {
          throw new Error(
            "Davomat mavjud emas — SalaryRecord yaratib bo‘lmaydi"
          );
        }

        const totalPercentage = emptyAttendances.reduce(
          (sum, a) => sum + a.percentage,
          0
        );
        const salaryPerPercent = loadAmount / totalPercentage;

        const workers = emptyAttendances.map((a) => ({
          employee: a.employee,
          percentage: a.percentage,
          amount: Math.round(salaryPerPercent * a.percentage),
        }));

        salaryRecord = await SalaryRecord.create({
          date: new Date(),
          department: "polizol",
          producedCount: 0,
          loadedCount,
          totalSum: loadAmount,
          salaryPerPercent,
          workers,
        });
      } else {
        // 4. Mavjud bo‘lsa: loadedCount, totalSum yangilanadi, workers qayta hisoblanadi

        const todayAttendances = await Attendance.find({
          date: {
            $gte: new Date(today),
            $lte: new Date(today.getTime() + 86399999),
          },
          unit: "polizol",
        });

        const totalPercentage = todayAttendances.reduce(
          (sum, a) => sum + a.percentage,
          0
        );

        const newLoadedCount = salaryRecord.loadedCount + loadedCount;
        const newTotalSum = salaryRecord.totalSum + loadAmount;
        const newSalaryPerPercent = newTotalSum / totalPercentage;

        const updatedWorkers = todayAttendances.map((a) => ({
          employee: a.employee,
          percentage: a.percentage,
          amount: Math.round(newSalaryPerPercent * a.percentage),
        }));

        salaryRecord.loadedCount = newLoadedCount;
        salaryRecord.totalSum = newTotalSum;
        salaryRecord.salaryPerPercent = newSalaryPerPercent;
        salaryRecord.workers = updatedWorkers;

        await salaryRecord.save();
      }

      // -----------------------------------------------------------------

      return response.created(
        res,
        "Shartnoma muvaffaqiyatli tuzildi!",
        populatedSale
      );
    } catch (error) {
      await session.abortTransaction();
      return response.serverError(
        res,
        "Sotuvni saqlashda xatolik!",
        error.message
      );
    } finally {
      session.endSession();
    }
  }

  async deliverProduct(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { saleId, items } = req.body;

      // 1. Sotuvni topamiz
      const sale = await Salecart.findById(saleId).session(session);
      if (!sale) {
        return response.notFound(res, "Sotuv topilmadi");
      }

      for (const item of items) {
        const { productId, quantity } = item;

        // 2. Tayyor mahsulotni topib, quantity ni kamaytiramiz
        const product = await FinishedProduct.findById(productId).session(session);
        if (!product) {
          return response.notFound(res, `Mahsulot topilmadi: ${productId}`);
        }

        if (product.quantity < quantity) {
          return response.error(res, `Mahsulot yetarli emas: ${product.productName}`);
        }

        product.quantity -= quantity;
        // Validate only modified fields to avoid issues with required fields like returnInfo
        await product.save({ session, validateModifiedOnly: true });

        const saleItem = sale.items.find(
          (i) =>
            i.productId &&
            productId &&
            i.productId.toString() === productId.toString()
        );

        if (!saleItem) {
          return response.error(res, `Sotuvda mahsulot topilmadi: ${productId}`);
        }

        saleItem.deliveredQuantity += quantity;
        saleItem.updatedAt = new Date();
      }

      await sale.save({ session });

      await session.commitTransaction();
      return response.success(res, "Mahsulotlar yetkazib berildi!");
    } catch (error) {
      await session.abortTransaction();
      return response.serverError(res, "Xatolik yuz berdi", error.message);
    } finally {
      session.endSession();
    }
  }
  async getSaleById(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return response.error(res, "Noto‘g‘ri sotuv ID formati!");
      }

      const sale = await Salecart.findById(id)
        .populate("customerId", "name type phone companyAddress")
        .populate("salerId", "firstName lastName")
        .lean();

      if (!sale) {
        return response.notFound(res, "Sotuv topilmadi!");
      }
      return response.success(res, "Muvaffaqiyatli", sale);
    } catch (error) {
      return response.serverError(
        res,
        "Sotuvni olishda xatolik!",
        error.message
      );
    }
  }

  // Update sale
  async updateSale(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const saleData = req.body;
      const existingSale = await Salecart.findById(req.params.id).session(
        session
      );
      if (!existingSale) {
        await session.abortTransaction();
        return response.notFound(res, "Sotuv topilmadi!");
      }

      // Calculate original sale amount
      const originalSaleAmount = existingSale.items.reduce(
        (sum, item) => sum + item.discountedPrice * item.quantity,
        0
      );

      // Get current month for plan
      const currentDate = new Date(existingSale.createdAt); // Use sale's creation date
      const month = `${currentDate.getFullYear()}.${String(
        currentDate.getMonth() + 1
      ).padStart(2, "0")}`;

      // Find plan for current month
      const plan = await Plan.findOne({
        employeeId: existingSale.salerId,
        month,
      }).session(session);

      if (!plan) {
        await session.abortTransaction();
        return response.notFound(
          res,
          `Sotuvchi uchun ${month} oyida plan topilmadi`
        );
      }

      // Handle customer update if provided
      if (saleData.customer) {
        let customer = await Customer.findOne({
          $or: [
            { phone: saleData.customer.phone || "" },
            {
              name: saleData.customer.name,
              type: saleData.customer.type || "individual",
            },
          ],
        }).session(session);

        if (!customer) {
          customer = new Customer({
            name: saleData.customer.name,
            phone: saleData.customer.phone || "",
            type: saleData.customer.type || "individual",
            companyAddress:
              saleData.customer.type === "company"
                ? saleData.customer.companyAddress
                : undefined,
          });
          await customer.save({ session });
        }
        saleData.customerId = customer._id;
        delete saleData.customer;
      }

      // Handle items update
      let newSaleAmount = originalSaleAmount;
      if (saleData.items) {
        // Restore original product quantities
        for (const item of existingSale.items) {
          const product = await FinishedProduct.findById(item._id).session(
            session
          );
          if (product) {
            product.quantity += item.quantity;
            await product.save({ session });
          }
        }

        // Validate and deduct new quantities
        for (const item of saleData.items) {
          const product = await FinishedProduct.findById(item._id).session(
            session
          );
          if (!product) {
            await session.abortTransaction();
            return response.notFound(
              res,
              `Maxsulot topilmadi: ${item.productName}`
            );
          }
          if (product.quantity < item.quantity) {
            await session.abortTransaction();
            return response.error(
              res,
              `Maxsulot ${item.productName} uchun yetarli miqdor yo'q`
            );
          }
          product.quantity -= item.quantity;
          await product.save({ session });
        }

        // Calculate new sale amount
        newSaleAmount = saleData.items.reduce(
          (sum, item) => sum + item.discountedPrice * item.quantity,
          0
        );
      }

      // Handle payment update
      if (saleData.payment) {
        if (saleData.payment.totalAmount < saleData.payment.paidAmount) {
          await session.abortTransaction();
          return response.error(
            res,
            "To'lov summasi yakuniy summadan oshib ketdi!"
          );
        }
        if (saleData.payment.paidAmount > 0 && !saleData.payment.paymentType) {
          await session.abortTransaction();
          return response.error(res, "To'lov turi kiritilmadi!");
        }

        if (existingSale.payment.paidAmount > 0) {
          const oldBalanceField =
            existingSale.payment.paymentType === "naqt" ? "naqt" : "bank";
          await Balance.updateBalance(
            oldBalanceField,
            "chiqim",
            existingSale.payment.paidAmount,
            { session }
          );
        }
        if (saleData.payment.paidAmount > 0) {
          const newBalanceField =
            saleData.payment.paymentType === "naqt" ? "naqt" : "bank";
          await Balance.updateBalance(
            newBalanceField,
            "kirim",
            saleData.payment.paidAmount,
            { session }
          );
        }
      }

      // Update plan
      const amountDifference = newSaleAmount - originalSaleAmount;
      plan.achievedAmount = Math.max(0, plan.achievedAmount + amountDifference);
      plan.progress =
        plan.targetAmount > 0
          ? Math.min((plan.achievedAmount / plan.targetAmount) * 100, 100)
          : 0;
      await plan.save({ session });

      // Update sale
      const sale = await Salecart.findByIdAndUpdate(
        req.params.id,
        { $set: saleData },
        { new: true, runValidators: true }
      ).session(session);

      await session.commitTransaction();
      const populatedSale = await Salecart.findById(sale._id)
        .populate("customerId", "name type phone companyAddress")
        .populate("salerId", "firstName lastName")
        .lean();

      return response.success(
        res,
        "Sotuv muvaffaqiyatli yangilandi!",
        populatedSale
      );
    } catch (error) {
      await session.abortTransaction();
      return response.serverError(
        res,
        "Sotuvni yangilashda xatolik!",
        error.message
      );
    } finally {
      session.endSession();
    }
  }

  // Delete sale

  async deleteSale(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const sale = await Salecart.findById(req.params.id).session(session);
      // console.log(sale);
      if (!sale) {
        return response.notFound(res, "Sotuv topilmadi!");
      }

      // Check if any items have been delivered
      const hasDeliveredItems = sale.items.some(
        (item) => item.deliveredQuantity > 0
      );
      if (hasDeliveredItems) {

        await session.abortTransaction();
        return response.error(
          res,
          "Sotuv o‘chirilmaydi: Mahsulotlar mijozga yetkazib berilgan!"
        );
      }

      // Calculate total sale amount
      const totalSaleAmount = sale.items.reduce(
        (sum, item) => sum + item.discountedPrice * item.quantity,
        0
      );

      // Get current month for plan based on sale's creation date
      const currentDate = new Date(sale.createdAt);
      const month = `${currentDate.getFullYear()}.${String(
        currentDate.getMonth() + 1
      ).padStart(2, "0")}`;

      // Find plan for current month
      const plan = await Plan.findOne({
        employeeId: sale.salerId,
        month,
      }).session(session);

      if (!plan) {
        await session.abortTransaction();
        return response.notFound(
          res,
          `Sotuvchi uchun ${month} oyida plan topilmadi`
        );
      }

      // Remove sale from plan and update achievedAmount
      plan.sales = plan.sales.filter(
        (saleId) => saleId.toString() !== sale._id.toString()
      );
      plan.achievedAmount = Math.max(0, plan.achievedAmount - totalSaleAmount);
      plan.progress =
        plan.targetAmount > 0
          ? Math.min((plan.achievedAmount / plan.targetAmount) * 100, 100)
          : 0;
      await plan.save({ session });

      // Restore product quantities to warehouse (only for non-delivered items)
      for (const item of sale.items) {
        const product = await FinishedProduct.findById(item._id).session(
          session
        );
        if (product) {
          product.quantity += item.quantity;
          await product.save({ session });
        }
      }

      // Update balance if there was a payment
      if (sale.payment.paidAmount > 0) {
        const balanceField =
          sale.payment.paymentType === "naqt" ? "naqt" : "bank";
        await Balance.updateBalance(
          balanceField,
          "chiqim",
          sale.payment.paidAmount,
          { session }
        );
      }

      // Delete sale and related expenses
      await Salecart.deleteOne({ _id: req.params.id }).session(session);
      await Expense.deleteMany({ relatedId: req.params.id }).session(session);

      await session.commitTransaction();
      return response.success(res, "Sotuv muvaffaqiyatli o‘chirildi!");
    } catch (error) {
      await session.abortTransaction();
      return response.serverError(
        res,
        "Sotuvni o‘chirishda xatolik!",
        error.message
      );
    } finally {
      session.endSession();
    }
  }

  // Process debt payment
  async payDebt(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { amount, description, paymentType } = req.body;

      // Validate input
      if (amount <= 0) {
        throw new Error("To‘lov summasi noto‘g‘ri kiritildi!");
      }
      if (!["naqt", "bank"].includes(paymentType)) {
        throw new Error("To‘lov turi noto‘g‘ri kiritildi!");
      }

      // Fetch sale with session
      const sale = await Salecart.findById(req.params.id).session(session);
      if (!sale) {
        throw new Error("Sotuv topilmadi!");
      }

      // Check if payment exceeds total amount
      const newPaidAmount = sale.payment.paidAmount + amount;
      if (newPaidAmount > sale.payment.totalAmount) {
        throw new Error("To‘lov summasi yakuniy summadan oshib ketdi!");
      }

      // Get month for the plan
      const currentDate = new Date(sale.createdAt);
      const month = `${currentDate.getFullYear()}.${String(
        currentDate.getMonth() + 1
      ).padStart(2, "0")}`;

      // Find plan for the sale's month
      const plan = await Plan.findOne({
        employeeId: sale.salerId,
        month,
      }).session(session);
      if (!plan) {
        throw new Error(`Sotuvchi uchun ${month} oyida plan topilmadi`);
      }

      // Update balance
      await Balance.updateBalance(paymentType, "kirim", amount, session);

      // Update sale payment details
      const updatedSale = await Salecart.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            "payment.paidAmount": newPaidAmount,
            "payment.debt": sale.payment.totalAmount - newPaidAmount,
            "payment.status":
              newPaidAmount >= sale.payment.totalAmount ? "paid" : "partial",
          },
          $push: {
            "payment.paymentHistory": {
              amount,
              date: new Date(),
              description,
              paidBy: sale.salesperson,
              paymentType,
            },
          },
        },
        { new: true, runValidators: true, session }
      );

      // Update plan
      plan.achievedAmount += amount;
      plan.progress = Math.min(
        (plan.achievedAmount / plan.targetAmount) * 100,
        100
      );
      await plan.save({ session });

      // Create expense record
      const expense = new Expense({
        relatedId: sale._id.toString(),
        type: "kirim",
        paymentMethod: paymentType,
        category: "Mijoz tulovi",
        amount,
        description,
        date: new Date(),
      });
      await expense.save({ session });

      // Commit transaction
      await session.commitTransaction();

      // Populate and return response
      const populatedSale = await Salecart.findById(updatedSale._id)
        .populate("customerId", "name type phone companyAddress")
        .populate("salerId", "firstName lastName")
        .lean();

      return response.success(
        res,
        "Qarz to‘lovi muvaffaqiyatli!",
        populatedSale
      );
    } catch (error) {
      await session.abortTransaction();
      return response.serverError(
        res,
        "Qarz to‘lovida xatolik!",
        error.message
      );
    } finally {
      session.endSession();
    }
  }

  //get customers all
  async getCompanys(req, res) {
    try {
      const customers = await Customer.find();
      return response.success(
        res,
        "Mijozlar muvaffaqiyatli o‘qildi!",
        customers
      );
    } catch (error) {
      return response.serverError(
        res,
        "Mijozlarni o‘qishda xatolik!",
        error.message
      );
    }
  }

  // Get sales filtered by customer and status
  async getCustomerSales(req, res) {
    try {
      const { customerId, status, month } = req.query;

      if (!mongoose.Types.ObjectId.isValid(customerId)) {
        return response.error(res, "Noto‘g‘ri mijoz ID formati!");
      }

      const query = { customerId };

      if (status) {
        if (status === "active") {
          query["payment.isActive"] = true;
        } else if (status === "completed") {
          query["payment.isActive"] = false;
        }
      }

      if (month && /^\d{2}\.\d{4}$/.test(month)) {
        const startDate = moment(month, "MM.YYYY").startOf("month").toDate();
        const endDate = moment(month, "MM.YYYY").endOf("month").toDate();
        query.createdAt = { $gte: startDate, $lte: endDate };
      }

      const sales = await Salecart.find(query)
        .populate("customerId", "name type phone companyAddress")
        .populate("salerId", "firstName lastName")
        .sort({ createdAt: -1 })
        .lean();

      if (!sales.length) {
        return response.success(res, "Sotuvlar topilmadi", []);
      }

      return response.success(res, "Mijoz sotuvlari ro‘yxati", sales);
    } catch (error) {
      return response.serverError(
        res,
        "Sotuvlarni olishda xatolik!",
        error.message
      );
    }
  }

  // Get customer sales history (completed sales)
  async getCustomerCompletedSales(req, res) {
    try {
      const { customerId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(customerId)) {
        return response.error(res, "Noto‘g‘ri mijoz ID formati!");
      }

      const sales = await Salecart.find({
        customerId,
        "payment.isActive": false,
      })
        .populate("customerId", "name type phone companyAddress")
        .populate("salerId", "firstName lastName")
        .sort({ createdAt: -1 })
        .lean();

      if (!sales.length) {
        return response.success(res, "Yakunlangan sotuvlar topilmadi", []);
      }

      return response.success(res, "Yakunlangan sotuvlar ro‘yxati", sales);
    } catch (error) {
      return response.serverError(
        res,
        "Yakunlangan sotuvlarni olishda xatolik!",
        error.message
      );
    }
  }

  // Get customer active sales (unpaid/partially paid)
  async getCustomerActiveSales(req, res) {
    try {
      const { customerId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(customerId)) {
        return response.error(res, "Noto‘g‘ri mijoz ID formati!");
      }

      const sales = await Salecart.find({
        customerId,
        "payment.isActive": true,
      })
        .populate("customerId", "name type phone companyAddress")
        .populate("salerId", "firstName lastName")
        .sort({ createdAt: -1 })
        .lean();

      if (!sales.length) {
        return response.success(res, "Faol sotuvlar topilmadi", []);
      }

      return response.success(res, "Faol sotuvlar ro‘yxati", sales);
    } catch (error) {
      return response.serverError(
        res,
        "Faol sotuvlarni olishda xatolik!",
        error.message
      );
    }
  }

  async getFilteredSales(req, res) {
    try {
      const { month } = req.query;

      if (!month || !/^\d{2}\.\d{4}$/.test(month)) {
        return response.error(
          res,
          "Noto‘g‘ri yoki yetishmayotgan 'month' parametri (MM.YYYY)"
        );
      }

      const startDate = moment(month, "MM.YYYY").startOf("month").toDate();
      const endDate = moment(month, "MM.YYYY").endOf("month").toDate();

      const sales = await Salecart.find({
        createdAt: { $gte: startDate, $lte: endDate },
      })
        .populate("customerId") // Populate the customerId field with Customer data
        .sort({ createdAt: -1 });

      if (!sales.length) {
        return response.success(
          res,
          "Ko‘rsatilgan oyning faol savdolari topilmadi",
          []
        );
      }

      return response.success(
        res,
        "Tanlangan oyning faol savdolar ro‘yxati",
        sales
      );
    } catch (err) {
      console.error("Error in getFilteredSales:", err);
      return response.serverError(res, "Server xatosi", err.message);
    }
  }


  // Process product returns
  async returnItems(req, res) {
    let session;
    try {
      session = await mongoose.startSession();
      await session.startTransaction();

      const { items, customerName, reason, paymentType, description } = req.body.body || req.body;
      console.log(items, customerName, reason, paymentType, description);
      if (!items?.length) {
        return response.error(res, 'Qaytarish uchun mahsulotlar kiritilmadi!');
      }
      if (!reason) {
        return response.error(res, 'Qaytarish sababi kiritilmadi!');
      }
      if (!['naqt', 'bank'].includes(paymentType)) {
        return response.error(res, 'To‘lov turi noto‘g‘ri kiritildi!');
      }

      const sale = await Salecart.findById(req.params.id).session(session);
      if (!sale) {
        return response.notFound(res, 'Sotuv topilmadi!');
      }

      // Calculate totalRefund dynamically
      let totalRefund = 0;

      for (const returnItem of items) {
        const { productId, productName, category, quantity } = returnItem;
        if (!productId || !productName || !category || !quantity) {
          return response.error(res, 'Mahsulot ma\'lumotlari to‘liq emas!');
        }

        const originalProduct = await FinishedProduct.findById(productId).session(session);
        if (!originalProduct) {
          return response.notFound(res, `Mahsulot topilmadi: ${productName}`);
        }

        const originalItem = sale.items.find(item => item.productId.toString() === productId);
        if (!originalItem || quantity > originalItem.quantity) {
          return response.error(res, `Qaytarish miqdori ${productName} uchun sotuv miqdoridan oshib ketdi!`);
        }

        const refundForItem = quantity * originalProduct.sellingPrice;
        totalRefund += refundForItem;

        const returnInfoEntry = {
          returnReason: reason,
          returnDescription: description || '',
          returnDate: new Date(),
          returnedQuantity: quantity,
          refundedAmount: refundForItem,
          companyName: customerName || "Nomalum",
        };

        // Check for existing returned product
        const existingReturned = await FinishedProduct.findOne({
          productName,
          category,
          isReturned: true,
          marketType: originalProduct.marketType,
          productionDate: originalProduct.productionDate,
        }).session(session);

        if (existingReturned) {
          existingReturned.quantity += quantity;
          existingReturned.returnInfo.push(returnInfoEntry);
          await existingReturned.save({ session });
        } else {
          const newProduct = new FinishedProduct({
            productName,
            category,
            quantity,
            marketType: originalProduct.marketType,
            productionDate: originalProduct.productionDate,
            productionCost: originalProduct.productionCost,
            sellingPrice: originalProduct.sellingPrice,
            isReturned: true,
            returnInfo: [returnInfoEntry],
          });
          await newProduct.save({ session });
        }
      }



      await Balance.updateBalance(paymentType, 'chiqim', totalRefund, session);

      const expense = new Expense({
        relatedId: sale._id.toString(),
        type: 'chiqim',
        paymentMethod: paymentType,
        category: 'Qaytgan mahsulot!',
        amount: totalRefund,
        description: `Sababi: ${reason}`,
        date: new Date(),
      });
      await expense.save({ session });

      const newPaidAmount = sale.payment.paidAmount - totalRefund;

      const updatedSale = await Salecart.findByIdAndUpdate(
        req.params.id,
        {
          // $set: {
          //   'payment.paidAmount': newPaidAmount,
          //   'payment.debt': sale.payment.totalAmount - newPaidAmount,
          //   'payment.status': newPaidAmount >= sale.payment.totalAmount ? 'paid' : 'partial',
          // },
          $push: {
            'payment.paymentHistory': {
              amount: -totalRefund,
              date: new Date(),
              description: `Qaytarish: ${reason}`,
              paidBy: sale.salesperson,
              paymentType,
            },
          },
        },
        { new: true, runValidators: true, session }
      );

      await session.commitTransaction();

      const populatedSale = await Salecart.findById(updatedSale._id)
        .populate('customerId', 'name type phone companyAddress')
        .populate('salerId', 'firstName lastName')
        .lean();

      return response.success(res, 'Mahsulot qaytarish muvaffaqiyatli!', populatedSale);
    } catch (error) {
      if (session?.inTransaction()) await session.abortTransaction();
      return response.serverError(res, 'Mahsulot qaytarishda xatolik!', error.message);
    } finally {
      if (session) await session.endSession();
    }
  }


  // Get transport records
  // Transport yozuvlarini olish
  async getTransport(req, res) {
    try {
      const { _id, amount } = req.query;

      if (_id && amount) {
        // Miqdorning to'g'riligini tekshirish
        const paymentAmount = parseFloat(amount);
        if (isNaN(paymentAmount) || paymentAmount <= 0) {
          return response.error(res, "Noto‘g‘ri miqdor kiritildi");
        }

        // MongoDB sessiyasini boshlash va tranzaksiyani ochish
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          // Transport yozuvini _id orqali sessiyada topish
          const transport = await Transport.findById(_id).session(session);
          if (!transport) {
            await session.abortTransaction();
            session.endSession();
            return response.notFound(res, "Transport topilmadi");
          }

          // Transport balansining yetarliligini tekshirish
          if (transport.balance < paymentAmount) {
            await session.abortTransaction();
            session.endSession();
            return response.error(
              res,
              "Transport balansida yetarli mablag‘ yo‘q"
            );
          }

          // Global balansni to'lov usuli 'naqt' yoki 'bank' bilan yangilash
          const paymentMethod = "naqt"; // Bu misolda 'naqt' qo‘llanilmoqda; kerak bo‘lsa o‘zgartiring
          await Balance.updateBalance(
            paymentMethod,
            "chiqim",
            paymentAmount,
            session
          );

          // Xarajat yozuvini yaratish
          const expense = new Expense({
            relatedId: _id,
            type: "chiqim",
            paymentMethod: paymentMethod,
            category: "Transport",
            amount: paymentAmount,
            description: "Shavfyoq uchun",
            date: new Date(),
          });
          await expense.save({ session });

          // Transport balansidan miqdorni ayirish
          transport.balance -= paymentAmount;
          await transport.save({ session });

          // Tranzaksiyani yakunlash
          await session.commitTransaction();
          session.endSession();

          return response.success(
            res,
            "To‘lov muvaffaqiyatli amalga oshirildi va xarajat yozib olindi",
            transport
          );
        } catch (error) {
          // Xato yuz berganda tranzaksiyani bekor qilish
          await session.abortTransaction();
          session.endSession();
          console.error("Tranzaksiya xatosi:", error);
          return response.serverError(
            res,
            "Tranzaksiya muvaffaqiyatsiz yakunlandi",
            error.message
          );
        }
      } else {
        // Barcha transport yozuvlarini olish (o'qish uchun tranzaksiya kerak emas)
        const transports = await Transport.find();
        return response.success(
          res,
          "Transportlar muvaffaqiyatli olindi",
          transports
        );
      }
    } catch (error) {
      console.error("Server xatosi:", error);
      return response.serverError(res, "Server xatosi", error.message);
    }
  }
}

module.exports = new SaleController();



