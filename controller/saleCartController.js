const { Salecart, Customer } = require("../model/saleCartSchema");
const Expense = require("../model/expenseModel");
const Material = require("../model/wherehouseModel");
const Balance = require("../model/balance");
const Employee = require("../model/adminModel");
const Plan = require("../model/planSalerModel");
const FinishedProduct = require("../model/finishedProductModel");
const response = require("../utils/response");
const Transport = require("../model/transportModel");
const mongoose = require("mongoose");
const moment = require("moment");

const calculateLoadedPrices = require("../controller/calculateSalary/calculateLoadedPrices");

class SaleController {
  async createSale(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        customer: customerData,
        customerType,
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

      const employee = await Employee.findById(salerId).session(session);
      if (!employee) {
        await session.abortTransaction();
        return response.notFound(res, "Sotuvchi topilmadi");
      }
      let customer = await Customer.findOne({
        name: customerData.name,
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

      const currentDate = new Date();
      const month = `${currentDate.getFullYear()}.${String(
        currentDate.getMonth() + 1
      ).padStart(2, "0")}`;

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
        item.productId = item._id;
      }

      const newSale = new Salecart({
        customerId: customer._id,
        salerId,
        items,
        payment,
        customerType,
        salesperson: `${employee.firstName} ${employee.lastName}`,
        date: new Date().toLocaleDateString("uz-UZ"),
        time: new Date().toLocaleTimeString("uz-UZ"),
        isContract: req.body.isContract ?? true,
      });

      if (payment.paidAmount > 0) {
        const balanceField = payment.paymentType === "naqt" ? "naqt" : "bank";
        await Balance.updateBalance(balanceField, "kirim", payment.paidAmount, {
          session,
        });

        plan.achievedAmount += payment.paidAmount;
        plan.progress = Math.min(
          (plan.achievedAmount / plan.targetAmount) * 100,
          100
        );
        await plan.save({ session });
      }

      const savedSale = await newSale.save({ session });

      plan.sales.push(savedSale._id);
      await plan.save({ session });

      await session.commitTransaction();

      const populatedSale = await Salecart.findById(savedSale._id)
        .populate("customerId", "name type phone companyAddress")
        .populate("salerId", "firstName lastName")
        .lean();

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
      const { saleId, items, transport, transportCost, deliveredGroups } =
        req.body;

      // Har bir item uchun discountedPrice * quantity
      const total = items.reduce((sum, item) => {
        return sum + item.discountedPrice * item.quantity;
      }, 0);

      if (!saleId || !items || !transport || transportCost === undefined) {
        await session.abortTransaction();
        return response.error(res, "Barcha maydonlar to'ldirilishi shart");
      }

      // 1️⃣ Customer olish
      const customer = await Customer.findById(saleId).session(session);
      if (!customer) {
        await session.abortTransaction();
        return response.notFound(res, "Mijoz topilmadi");
      }

      // 2️⃣ Mijozning sotuv tarixlari
      const sales = await Salecart.find({ customerId: customer._id }).session(
        session
      );
      if (!sales || sales.length === 0) {
        await session.abortTransaction();
        return response.notFound(res, "Mijozning sotuv tarixi topilmadi");
      }

      // 3️⃣ Transport yozuvi
      let transportRecord = await Transport.findOne({ transport }).session(
        session
      );
      if (!transportRecord) {
        transportRecord = new Transport({ transport, balance: transportCost });
      } else {
        transportRecord.balance += transportCost;
      }
      await transportRecord.save({ session });

      // 4️⃣ Itemlar bo‘yicha yurish
      for (const item of items) {
        let quantityToDeliver = item.quantity;
        const { productId, productName } = item;

        // 1) Shu mahsulot qatnashgan barcha buyurtmalarni yig‘ib olamiz
        const candidateSales = sales.filter((sale) =>
          sale.items.some((i) => i.productName === productName)
        );

        if (candidateSales.length === 0) {
          await session.abortTransaction();
          return response.error(res, `Mahsulot topilmadi: ${productName}`);
        }

        // 2) Har bir buyurtma bo‘yicha ketma-ket yuborish
        for (const sale of candidateSales) {
          const saleItem = sale.items.find(
            (i) => i.productName === productName
          );

          // Oldin yuborilgan miqdorni hisoblash
          const alreadyDelivered = sale.deliveredItems
            .filter((di) => di.productName === productName)
            .reduce((sum, di) => sum + di.deliveredQuantity, 0);

          const remaining = saleItem.quantity - alreadyDelivered;
          if (remaining <= 0) continue; // Bu buyurtma to‘liq yuborilgan

          // Nechta yuboramiz (kamroq miqdorni tanlaymiz)
          const deliverNow = Math.min(quantityToDeliver, remaining);

          if (deliverNow > 0) {
            // 🔹 Omborni kamaytirish
            // let product = await Material.findById(productName).session(session);
            // if (!product) {
            //   product = await FinishedProduct.findById(productName).session(
            //     session
            //   );
            // }
            let product = await Material.findOne({ name: productName }).session(
              session
            );
            if (!product) {
              product = await FinishedProduct.findOne({
                productName: productName,
              }).session(session);
            }
            if (!product || product.quantity < deliverNow) {
              await session.abortTransaction();
              return response.error(
                res,
                `Mahsulot yetarli emas: ${productName}`
              );
            }
            product.quantity -= deliverNow;
            await product.save({ session, validateModifiedOnly: true });

            // 🔹 deliveredItems ga yozish
            sale.deliveredItems.push({
              productId,
              productName,
              deliveredQuantity: deliverNow,
              totalAmount: deliverNow * saleItem.pricePerUnit,
              transport,
              transportCost,
              deliveryDate: new Date(),
              deliveredGroups,
            });
            await sale.save({ session });

            // Qancha qolganini kamaytiramiz
            quantityToDeliver -= deliverNow;
            if (quantityToDeliver === 0) break; // Hamma yuborildi
          }
        }

        // Agar hali ham yuborilmagan qismi qolsa => xato
        if (quantityToDeliver > 0) {
          await session.abortTransaction();
          return response.error(
            res,
            `${productName} mahsulotidan ortiqcha yuborishga urinildi`
          );
        }
      }

      // 5️⃣ Customer balansiga umumiy summani qo‘shish
      customer.balans += total;
      await customer.save({ session, validateModifiedOnly: true });

      await calculateLoadedPrices(new Date(), session);

      await session.commitTransaction();
      return response.success(res, "Mahsulotlar muvaffaqiyatli yetkazildi!", {
        customer,
        sales,
      });
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
    try {
      session.startTransaction();

      const sale = await Salecart.findById(req.params.id).session(session);
      if (!sale) {
        await session.abortTransaction();
        return response.notFound(res, "Sotuv topilmadi!");
      }

      if (sale.deliveredItems?.length > 0) {
        await session.abortTransaction();
        return response.error(
          res,
          "Sotuv o‘chirilmaydi: Mahsulotlar mijozga yetkazib berilgan!"
        );
      }

      await Salecart.findByIdAndDelete(req.params.id).session(session);

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

  // mijoz qarzini to‘lash
  async payDebt(req, res) {
    const session = await Customer.startSession();
    session.startTransaction();

    try {
      const { customerId, amount, description, paidBy, paymentType } = req.body;

      if (!customerId || !amount) {
        return response.warning(res, "Barcha maydonlar to‘ldirilishi kerak!");
      }

      const customer = await Customer.findById(customerId).session(session);
      if (!customer) {
        return response.notFound(res, "Mijoz topilmadi");
      }

      let remaining = amount; // ❌ oldin +balans qo‘shilgan edi, endi to‘g‘riladik

      // qarzlari bor savdolarni eng eski tarixdan olish
      const sales = await Salecart.find({
        customerId,
        "payment.debt": { $gt: 0 },
      })
        .sort({ createdAt: 1 })
        .session(session);

      for (let sale of sales) {
        if (remaining <= 0) break;

        let debt = sale.payment.debt;
        let payNow = Math.min(remaining, debt);

        sale.payment.paidAmount += payNow;
        sale.payment.debt -= payNow;
        remaining -= payNow;

        if (sale.payment.debt === 0) {
          sale.payment.isActive = false;
          sale.payment.status = "paid";
        } else {
          sale.payment.status = "partial";
        }

        sale.payment.paymentHistory.push({
          amount: payNow,
          paidBy,
          paymentType: paymentType || "naqt",
        });

        await sale.save({ session });
      }
      // Har bir yopilgan qarz uchun expense yozamiz
      const expense = new Expense({
        relatedId: customerId,
        type: "kirim",
        paymentMethod: paymentType || "naqt",
        category: "Mijoz tulovi",
        amount,
        description: description || "Mijoz qarz to'lovi",
        date: new Date(),
      });
      await expense.save({ session });

      // umumiy kassaga yozish
      await Balance.updateBalance(
        paymentType || "naqt",
        "kirim",
        amount,
        session
      );

      // Agar qarzlar yopilib bo‘lsa va ortiqcha pul qolsa → balansga yozamiz
      customer.balans -= amount;
      await customer.save({ session });

      await session.commitTransaction();
      session.endSession();

      return response.success(res, "To'lov muvaffaqiyatli amalga oshirildi", {
        qolganBalans: customer.balans,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      return response.serverError(res, "Xatolik yuz berdi", {
        error: error.message,
      });
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
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 15;
      const search = req.query.search || ''; // Uncommented: search parametri

      let customers = await Customer.find().lean();
      if (!customers.length) {
        return response.notFound(res, "Mijozlar topilmadi", []);
      }

      // Yangi: search bo'lsa, mijozlarni filtrla (name va phone bo'yicha)
      let filteredCustomers = customers;
      if (search) {
        filteredCustomers = customers.filter(c =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.phone && c.phone.toLowerCase().includes(search.toLowerCase()))
        );
      }

      const result = await Promise.all(
        filteredCustomers.map(async (customer) => {
          const sales = await Salecart.find({ customerId: customer._id })
            .populate("customerId", "name type phone company balans")
            .sort({ createdAt: -1 })
            .lean();
          sales.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

          const expenses = await Expense.find({ relatedId: customer._id }).lean();

          let totalUndelivered = 0;
          const groupedDeliveredItems = {};
          sales.forEach((sale) => {
            sale.items.forEach((item) => {
              const delivered = sale.deliveredItems
                .filter((d) => String(d.productId) === String(item.productId))
                .reduce((sum, d) => sum + (d.deliveredQuantity || 0), 0);
              const remaining = item.quantity - delivered;
              if (remaining > 0) totalUndelivered += remaining;
            });

            sale.deliveredItems.forEach((d) => {
              const dateKey = new Date(d.deliveryDate).toISOString().slice(0, 13);
              if (!groupedDeliveredItems[dateKey]) groupedDeliveredItems[dateKey] = [];
              groupedDeliveredItems[dateKey].push(d);
            });
          });

          let balansStatus = "0";
          if (customer.balans > 0) balansStatus = "Qarzdor";
          else if (customer.balans < 0) balansStatus = "Haqdor";
          else balansStatus = "Mavjud emas";

          const lastSaleDate = sales.length ? new Date(sales[0].createdAt) : null;

          return {
            ...customer,
            balansStatus,
            history: sales,
            Expenses: expenses,
            totalUndelivered,
            lastSaleDate,
            groupedDeliveredItems,
          };
        })
      );

      const now = new Date();
      const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;

      // recentSales: oxirgi 15 kun ichida savdosi bo‘lgan mijozlar
      const recentSales = result
        .filter(c => c.lastSaleDate && now - new Date(c.lastSaleDate) <= FIFTEEN_DAYS_MS)
        .sort((a, b) => new Date(b.lastSaleDate) - new Date(a.lastSaleDate)); // eng yangi tepada

      // oldSales: 15 kundan eski yoki savdosi bo‘lmagan mijozlar
      let oldSales = result
        .filter(c => !c.lastSaleDate || now - new Date(c.lastSaleDate) > FIFTEEN_DAYS_MS)
        .sort((a, b) => new Date(b.lastSaleDate) - new Date(a.lastSaleDate));

      // Yangi: to'liq filtrlangan statistika (search va pagination ga qaramay to'liq hisoblanadi)
      const totalCustomers = result.length;
      const totalQarzdorAmount = result
        .filter(c => c.balansStatus === "Qarzdor")
        .reduce((sum, c) => sum + (c.balans || 0), 0);
      const totalHaqdorAmount = result
        .filter(c => c.balansStatus === "Haqdor")
        .reduce((sum, c) => sum + (c.balans || 0), 0);

      // Pagination oldSales (faqat oldSales uchun)
      const paginatedOldSales = oldSales.slice((page - 1) * limit, page * limit);

      return response.success(res, "Tanlangan oyning faol savdolar ro‘yxati", {
        recentSales,
        oldSales: paginatedOldSales,
        totalOldSalesCount: oldSales.length, // To'liq old soni (filtrlangan)
        totalCustomers, // To'liq mijozlar soni (search ga qarab)
        totalQarzdorAmount, // To'liq qarzdor summasi (search ga qarab)
        totalHaqdorAmount, // To'liq haqdor summasi (search ga qarab)
      });

    } catch (err) {
      return response.serverError(res, "Server xatosi", err.message);
    }
  }

  async getUndeliveredItems(req, res) {
    try {
      const { customerId } = req.params;

      const sales = await Salecart.find({ customerId }).lean();

      if (!sales || sales.length === 0) {
        return response.notFound(res, "Sotuvlar topilmadi", { overallResult: [] });
      }

      const allOrders = sales.flatMap(sale =>
        (sale.items || []).map(item => ({
          productId: item.productId.toString(),
          productName: item.productName,
          quantity: item.quantity,
          discountedPrice: item.discountedPrice,
          size: item.size,
        }))
      );

      const allDelivered = sales.flatMap(sale =>
        (sale.deliveredItems || []).map(del => ({
          productId: del.productId.toString(),
          productName: del.productName,
          deliveredQuantity: del.deliveredQuantity,
          discountedPrice: del.discountedPrice,
          size: del.size,
        }))
      );

      // ===== JAMLAB OLISh =====
      // JAMLAB OLISh
      const grouped = {};

      // 1. Buyurtmalarni jamlash
      allOrders.forEach(item => {
        const key = item.productId.toString();
        if (!grouped[key]) {
          grouped[key] = {
            productName: item.productName,
            productId: item.productId,
            ordered: 0,
            delivered: 0,
            discountedPrice: item.discountedPrice,
            size: item.size
          };
        }
        grouped[key].ordered += item.quantity;
      });

      // 2. Yuborilganlarni jamlash
      allDelivered.forEach(del => {
        const key = del.productId.toString();
        if (!grouped[key]) {
          grouped[key] = {
            productName: del.productName,
            productId: del.productId,
            ordered: 0,
            delivered: 0,
            discountedPrice: del.discountedPrice,
            size: del.size
          };
        }
        grouped[key].delivered += del.deliveredQuantity;
      });

      // 3. Qoldiqni hisoblash
      const finalResult = Object.values(grouped).map(item => ({
        productName: item.productName,
        productId: item.productId,
        ordered: item.delivered,          // buyurtma qilingan jami
        delivered: item.ordered,      // jami yuborilgan
        remaining: item.delivered - item.ordered,
        discountedPrice: item.discountedPrice,
        size: item.size
      })).filter(item => item.remaining > 0);  // remaining 0 bo'lganlarni olib tashlash

      return response.success(res, "Qoldiq mahsulotlar ro'yxati", { overallResult: finalResult });

    } catch (error) {
      return response.serverError(res, "Server xatosi", error.message);
    }
  }

  // Process product returns
  async returnItems(req, res) {
    let session;
    try {
      session = await mongoose.startSession();
      await session.startTransaction();

      const { items, customerName, reason, paymentType, description } =
        req.body.body || req.body;

      if (!items?.length) {
        return response.error(res, "Qaytarish uchun mahsulotlar kiritilmadi!");
      }
      if (!reason) {
        return response.error(res, "Qaytarish sababi kiritilmadi!");
      }
      if (!["naqt", "bank"].includes(paymentType)) {
        return response.error(res, "To‘lov turi noto‘g‘ri kiritildi!");
      }

      const sale = await Salecart.findById(req.params.id).session(session);
      if (!sale) {
        return response.notFound(res, "Sotuv topilmadi!");
      }

      // Calculate totalRefund dynamically
      let totalRefund = 0;

      for (const returnItem of items) {
        const { productId, productName, category, quantity } = returnItem;
        if (!productId || !productName || !category || !quantity) {
          return response.error(res, "Mahsulot ma'lumotlari to‘liq emas!");
        }

        const originalProduct = await FinishedProduct.findById(
          productId
        ).session(session);
        if (!originalProduct) {
          return response.notFound(res, `Mahsulot topilmadi: ${productName}`);
        }

        const originalItem = sale.items.find(
          (item) => item.productId.toString() === productId
        );
        if (!originalItem || quantity > originalItem.quantity) {
          return response.error(
            res,
            `Qaytarish miqdori ${productName} uchun sotuv miqdoridan oshib ketdi!`
          );
        }

        const refundForItem = quantity * originalProduct.sellingPrice;
        totalRefund += refundForItem;

        const returnInfoEntry = {
          returnReason: reason,
          returnDescription: description || "",
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

      await Balance.updateBalance(paymentType, "chiqim", totalRefund, session);

      const expense = new Expense({
        relatedId: sale._id.toString(),
        type: "chiqim",
        paymentMethod: paymentType,
        category: "Qaytgan mahsulot!",
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
            "payment.paymentHistory": {
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
        .populate("customerId", "name type phone companyAddress")
        .populate("salerId", "firstName lastName")
        .lean();

      return response.success(
        res,
        "Mahsulot qaytarish muvaffaqiyatli!",
        populatedSale
      );
    } catch (error) {
      if (session?.inTransaction()) await session.abortTransaction();
      return response.serverError(
        res,
        "Mahsulot qaytarishda xatolik!",
        error.message
      );
    } finally {
      if (session) await session.endSession();
    }
  }

  // Get transport records
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
      return response.serverError(res, "Server xatosi", error.message);
    }
  }
}

module.exports = new SaleController();