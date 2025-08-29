const Attendance = require("../../model/attendanceModal");
const SalaryRecord = require("../../model/salaryRecord");
const Salecart = require("../../model/saleCartSchema");
const { Product: ProductPriceInfo } = require("../../model/factoryModel");

const FinishedProduct = require("../../model/finishedProductModel");
const mongoose = require("mongoose");

async function calculateLoadedPrices(date, externalSession) {
  const session = externalSession || (await mongoose.startSession());
  let isNewSession = !externalSession;

  if (isNewSession) session.startTransaction();

  try {
    // const startOfDay = new Date(date);
    const startOfDay = new Date();
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

      let salaryPerWorker = loadAmount / totalAttendances.length;

      for (const dept of item.deliveredGroups) {
        let salaryRecord = await SalaryRecord.findOne({
          date: { $gte: startOfDay, $lte: endOfDay },
          department: dept,
        }).session(session);

        const attendances = totalAttendances.filter((att) => att.unit === dept);

        if (!salaryRecord) {
          if (attendances.length === 0) continue; // Ishchilar yo‘q bo‘lsa, o‘tkazib yuboramiz

          const workers = attendances.map((att) => ({
            employee: att.employee,
            percentage: att.percentage,
            amount: salaryPerWorker,
          }));

          salaryRecord = new SalaryRecord({
            date: new Date(),
            department: dept,
            producedCount: 0,
            loadedCount: 0, // kerak bo‘lsa, loadedCount hisoblang
            totalSum: salaryPerWorker * attendances.length,
            workers,
          });

          await salaryRecord.save({ session });
        } else {
          // Faqat bugungi davomatdagi ishchilarga ish haqini qo‘shamiz
          const empSet = new Set(
            attendances.map((att) => att.employee.toString())
          );

          salaryRecord.workers.forEach((worker) => {
            if (empSet.has(worker.employee.toString())) {
              worker.amount = (worker.amount || 0) + salaryPerWorker;
            }
          });

          salaryRecord.totalSum += salaryPerWorker * attendances.length;

          await salaryRecord.save({ session, validateModifiedOnly: true });
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
// calculateLoadedPrices();
module.exports = calculateLoadedPrices;
