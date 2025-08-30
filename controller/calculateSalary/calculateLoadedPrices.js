const Attendance = require("../../model/attendanceModal");
const SalaryRecord = require("../../model/salaryRecord");
const Salecart = require("../../model/saleCartSchema");
const { Product: ProductPriceInfo } = require("../../model/factoryModel");

const FinishedProduct = require("../../model/finishedProductModel");
const Admins = require("../../model/adminModel");

const mongoose = require("mongoose");

async function calculateLoadedPrices(date, externalSession) {
  const session = externalSession || (await mongoose.startSession());
  let isNewSession = !externalSession;

  if (isNewSession) session.startTransaction();

  try {
    const startOfDay = new Date(date);
    // const startOfDay = new Date();
    const hour = startOfDay.getHours();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay.getTime() + 86399999);

    // sales todays
    const sales = await Salecart.Salecart.find({
      "deliveredItems.deliveryDate": { $gte: startOfDay, $lte: endOfDay },
    })
      .select("deliveredItems")
      .lean()
      .session(session);

    const totalSalesData = (sales || []).flatMap((sale) =>
      Array.isArray(sale.deliveredItems) ? sale.deliveredItems : []
    );

    for (const item of totalSalesData) {
      let loadAmount = 0;

      const product = await FinishedProduct.findById(item.productId).session(
        session
      );

      if (product) {
        let priceInfo = await ProductPriceInfo.findOne({
          category: { $regex: `^${product.category}$`, $options: "i" },
        });

        if (!priceInfo) {
          console.log(
            "Price info not found for category:",
            product.category,
            product.productName
          );
        }

        if (priceInfo) {
          loadAmount += priceInfo.loadingCost * item.deliveredQuantity;
        }
      }

      const baseAttendanceQuery = {
        date: { $gte: startOfDay, $lte: endOfDay },
        percentage: hour >= 12 ? { $gt: 0.5 } : { $gt: 0 }, // 12:00 dan keyin faqat 0.5+
      };

      let totalAttendances = await Attendance.find({
        ...baseAttendanceQuery,
        unit: { $in: item.deliveredGroups },
      }).session(session);

      // faqat bolim boshliqlari
      const managerialUnits = [
        "polizol ish boshqaruvchi",
        "rubiroid ish boshqaruvchi",
        "Okisleniya ish boshqaruvchi",
      ];

      let bolimBoshliqlari = await Admins.find({
        unit: { $in: managerialUnits },
      });

      totalAttendances = [...totalAttendances];

      let workersData = totalAttendances.map((item) => {
        let state = bolimBoshliqlari.some(
          (bolim) => bolim._id.toString() === item.employee.toString()
        );
        return {
          ...item.toObject(),
          salaryPart: state ? 1.2 : 1,
        };
      });

      let totalPercentage = workersData.reduce(
        (sum, worker) => sum + worker.salaryPart,
        0
      );
      salaryPerWorker = loadAmount / totalPercentage;

      for (const dept of item.deliveredGroups) {
        let salaryRecord = await SalaryRecord.findOne({
          date: { $gte: startOfDay, $lte: endOfDay },
          department: dept,
        }).session(session);

        const attendances = workersData.filter((att) => att.unit === dept);

        if (!salaryRecord) {
          if (attendances.length === 0) continue; // Ishchilar yo‘q bo‘lsa, o‘tkazib yuboramiz

          const workers = attendances.map((att) => ({
            employee: att.employee,
            percentage: att.percentage,
            amount: salaryPerWorker * att.salaryPart,
          }));

          salaryRecord = new SalaryRecord({
            date: new Date(),
            department: dept,
            producedCount: 0,
            loadedCount: 0, // kerak bo‘lsa, loadedCount hisoblang
            totalSum: loadAmount,
            salaryPerPercent: salaryPerWorker,
            workers,
          });

          await salaryRecord.save({ session });
        } else {
          // ✅ Agar salaryRecord topilsa, yangilaymiz
          // mavjud ishchilarni yangilash / qo'shish
          for (const att of attendances) {
            const idx = salaryRecord.workers.findIndex(
              (w) => w.employee.toString() === att.employee.toString()
            );

            const newAmount = salaryPerWorker * att.salaryPart;

            if (idx === -1) {
              // yangi ishchi qo‘shamiz
              salaryRecord.workers.push({
                employee: att.employee,
                percentage: att.percentage,
                amount: newAmount,
              });
            } else {
              // mavjud ishchini yangilaymiz
              salaryRecord.workers[idx].percentage = att.percentage;
              salaryRecord.workers[idx].amount = newAmount;
            }
          }

          // umumiy summani qo‘shib boramiz
          salaryRecord.totalSum += loadAmount;

          // agar producedCount yoki loadedCount yangilash kerak bo‘lsa
          // salaryRecord.producedCount += something;
          // salaryRecord.loadedCount += ;

          await salaryRecord.save({ session });
        }
      }
    }
    if (isNewSession) await session.commitTransaction();
  } catch (error) {
    if (isNewSession) await session.abortTransaction();
    throw error;
  } finally {
    if (isNewSession) session.endSession();
  }
}

module.exports = calculateLoadedPrices;
