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
const SalaryRecord = require("../model/salaryRecord");
const Attendance = require("../model/attendanceModal");

const { Product: ProductPriceInfo } = require("../model/factoryModel");

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

      const currentDate = new Date();
      const month = `${currentDate.getFullYear()}.${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

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
        let { productId, productName, quantity } = item;
        let remainingToDeliver = quantity;

        // Shu mahsulot bor bo'lgan barcha sotuvlarni topamiz
        const relatedSales = sales.filter(sale =>
          sale.items.some(i => i.productId.toString() === productId.toString())
        );

        if (relatedSales.length === 0) {
          await session.abortTransaction();
          return response.error(res, `Mahsulot topilmadi: ${productName}`);
        }

        // 🔹 Umumiy yuborilmagan miqdorni hisoblash
        let totalRemaining = 0;
        for (const sale of relatedSales) {
          const saleItem = sale.items.find(
            i => i.productId.toString() === productId.toString()
          );
          const alreadyDelivered = sale.deliveredItems
            .filter(di => di.productId.toString() === productId.toString())
            .reduce((sum, di) => sum + di.deliveredQuantity, 0);

          totalRemaining += (saleItem.quantity - alreadyDelivered);
        }

        if (quantity > totalRemaining) {
          await session.abortTransaction();
          return response.error(
            res,
            `${productName} uchun maksimal ${totalRemaining} dona yuborish mumkin`
          );
        }

        // 🔹 Endi optimal taqsimlaymiz
        for (const sale of relatedSales) {
          if (remainingToDeliver <= 0) break;

          const saleItem = sale.items.find(
            i => i.productId.toString() === productId.toString()
          );
          const alreadyDelivered = sale.deliveredItems
            .filter(di => di.productId.toString() === productId.toString())
            .reduce((sum, di) => sum + di.deliveredQuantity, 0);

          const remaining = saleItem.quantity - alreadyDelivered;
          if (remaining <= 0) continue;

          const deliverNow = Math.min(remaining, remainingToDeliver);

          // Ombordan kamaytirish
          let product = await Material.findById(productId).session(session);
          if (!product) {
            product = await FinishedProduct.findById(productId).session(session);
          }
          if (!product || product.quantity < deliverNow) {
            await session.abortTransaction();
            return response.error(res, `Mahsulot yetarli emas: ${productName}`);
          }
          product.quantity -= deliverNow;
          await product.save({ session, validateModifiedOnly: true });

          // deliveredItems ga yozish
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

          remainingToDeliver -= deliverNow;
        }
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
      const { saleId, items, transport, transportCost, deliveredGroups } = req.body;

      // Har bir item uchun discountedPrice * quantity
      const total = items.reduce((sum, item) => {
        return sum + (item.discountedPrice * item.quantity);
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
      const sales = await Salecart.find({ customerId: customer._id }).session(session);
      if (!sales || sales.length === 0) {
        await session.abortTransaction();
        return response.notFound(res, "Mijozning sotuv tarixi topilmadi");
      }

      // 3️⃣ Transport yozuvi
      let transportRecord = await Transport.findOne({ transport }).session(session);
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
        const candidateSales = sales.filter(sale =>
          sale.items.some(i => i.productId.toString() === productId.toString())
        );

        if (candidateSales.length === 0) {
          await session.abortTransaction();
          return response.error(res, `Mahsulot topilmadi: ${productName}`);
        }

        // 2) Har bir buyurtma bo‘yicha ketma-ket yuborish
        for (const sale of candidateSales) {
          const saleItem = sale.items.find(
            i => i.productId.toString() === productId.toString()
          );

          // Oldin yuborilgan miqdorni hisoblash
          const alreadyDelivered = sale.deliveredItems
            .filter(di => di.productId.toString() === productId.toString())
            .reduce((sum, di) => sum + di.deliveredQuantity, 0);

          const remaining = saleItem.quantity - alreadyDelivered;
          if (remaining <= 0) continue; // Bu buyurtma to‘liq yuborilgan

          // Nechta yuboramiz (kamroq miqdorni tanlaymiz)
          const deliverNow = Math.min(quantityToDeliver, remaining);

          if (deliverNow > 0) {
            // 🔹 Omborni kamaytirish
            let product = await Material.findById(productId).session(session);
            if (!product) {
              product = await FinishedProduct.findById(productId).session(session);
            }
            if (!product || product.quantity < deliverNow) {
              await session.abortTransaction();
              return response.error(res, `Mahsulot yetarli emas: ${productName}`);
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

        // Har bir yopilgan qarz uchun expense yozamiz
        const expense = new Expense({
          relatedId: customerId,
          type: "kirim",
          paymentMethod: paymentType || "naqt",
          category: "Mijoz tulovi",
          amount: payNow,
          description: description || "Mijoz qarz to'lovi",
          date: new Date(),
        });
        await expense.save({ session });
      }

      // umumiy kassaga yozish
      await Balance.updateBalance(paymentType || "naqt", "kirim", amount, session);

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
      console.error(error);
      return response.serverError(res, "Xatolik yuz berdi", { error: error.message });
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

  // Bitta customer va uning tarixi bilan olish
  async getFilteredSales(req, res) {
    try {
      // Barcha customerlarni topish
      const customers = await Customer.find().lean();
      if (!customers || customers.length === 0) {
        return response.notFound(res, "Mijozlar topilmadi", []);
      }

      // Har bir customer uchun sales tarixini olish
      const result = await Promise.all(
        customers.map(async (customer) => {
          const sales = await Salecart.find({ customerId: customer._id })
            .populate("customerId", "name type phone company balans")
            .lean();

          // Shu customerga tegishli barcha to‘lovlar
          const expenses = await Expense.find({ relatedId: customer._id }).lean();

          // 🔥 Umuman yuborilmagan yoki qisman yuborilgan mahsulotlarni hisoblash
          let totalUndelivered = 0;
          const groupedDeliveredItems = {};
          sales.forEach((sale) => {
            sale.items.forEach((item) => {
              // Shu mahsulotdan qancha yetkazilganligini topamiz
              const delivered = sale.deliveredItems
                .filter((d) => String(d.productId) === String(item.productId))
                .reduce((sum, d) => sum + (d.deliveredQuantity || 0), 0);

              const remaining = item.quantity - delivered;
              if (remaining > 0) {
                totalUndelivered += remaining; // qolgan mahsulotlarni qo‘shamiz
              }
            });

            // 🔥 deliveryDate bo'yicha guruhlash
            sale.deliveredItems.forEach((deliveredItem) => {
              // deliveryDate ni YYYY-MM-DD formatiga aylantirish
              const dateKey = new Date(deliveredItem.deliveryDate)
                .toISOString()
                .slice(0, 13); // sana va soat (2025-08-28T06)

              if (!groupedDeliveredItems[dateKey]) {
                groupedDeliveredItems[dateKey] = [];
              }
              groupedDeliveredItems[dateKey].push(deliveredItem);
            });
          });



          // Balansni tekshirish va status berish
          let balansStatus = "0";
          if (customer.balans > 0) {
            balansStatus = `Qarzdor`;
          } else if (customer.balans < 0) {
            balansStatus = `Haqdor`;
          } else {
            balansStatus = "Mavjud emas";
          }

          // Savdo va To‘lovlarni bitta massivga qo‘shamiz
          const history = [
            ...sales.map((s) => ({
              ...s,
              _type: "sale",
              date: s.createdAt,
            })),
          ].sort((a, b) => new Date(b.date) - new Date(a.date)); // eng oxirgi savdo oldinda

          const Expenses = [
            ...expenses.map((e) => ({
              ...e,
              date: e.date,
            })),
          ].sort((a, b) => new Date(b.date) - new Date(a.date));

          // ❗ Har bir customer uchun eng oxirgi savdo sanasini olish
          const lastSaleDate = sales.length
            ? new Date(Math.max(...sales.map((s) => new Date(s.createdAt))))
            : null;

          return {
            ...customer,
            balansStatus,
            history: sales,
            Expenses,
            totalUndelivered,
            lastSaleDate, // 🔥 bu bilan sort qilamiz
            groupedDeliveredItems, // 🔥 Guruhlangan deliveredItems (sana va soat)
          };
        })
      );

      // ❗ Customerslarni oxirgi savdo sanasiga qarab sort qilish (eng yangisi oldinda)
      result.sort((a, b) => {
        if (!a.lastSaleDate) return 1; // agar savdosi bo‘lmasa pastga tushadi
        if (!b.lastSaleDate) return -1;
        return new Date(b.lastSaleDate) - new Date(a.lastSaleDate);
      });

      // Yakuniy data
      return response.success(
        res,
        "Tanlangan oyning faol savdolar ro‘yxati",
        result
      );
    } catch (err) {
      return response.serverError(res, "Server xatosi", err.message);
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
