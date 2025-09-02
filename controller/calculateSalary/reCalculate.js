const Attendance = require("../../model/attendanceModal");
const SalaryRecord = require("../../model/salaryRecord");
const Salecart = require("../../model/saleCartSchema");
const { Product: ProductPriceInfo } = require("../../model/factoryModel");

async function updateSalaryRecordForDate(department, date, externalSession) {
  // Transaction session — tashqaridan kelsa o‘sha, kelmasa yangi yaratamiz
  const session = externalSession || (await mongoose.startSession());
  let isNewSession = !externalSession;

  if (isNewSession) session.startTransaction();

  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay.getTime() + 86399999);

    const attendances = await Attendance.find({
      date: { $gte: startOfDay, $lte: endOfDay },
      unit: department,
    }).session(session);

    if (attendances.length === 0) {
      if (isNewSession) await session.abortTransaction();
      return { success: false, message: "Davomat mavjud emas" };
    }

    const salaryRecord = await SalaryRecord.findOne({
      date: { $gte: startOfDay, $lte: endOfDay },
      department: department,
    }).session(session);

    const loadedCountFromDeliveries = await getLoadedCountForDepartment(
      department,
      startOfDay,
      endOfDay,
      session
    );

    // let loadedPrice = await ProductPriceInfo

    const loadAmount = loadedCountFromDeliveries * 400;
    const totalPercentage = attendances.reduce(
      (sum, a) => sum + a.percentage,
      0
    );
    const salaryPerPercent = totalPercentage ? loadAmount / totalPercentage : 0;

    const workers = attendances.map((a) => ({
      employee: a.employee,
      percentage: a.percentage,
      amount: Math.round(salaryPerPercent * a.percentage),
    }));

    if (!salaryRecord) {
      await new SalaryRecord({
        date: startOfDay,
        department: department,
        producedCount: 0,
        loadedCount: loadedCountFromDeliveries,
        totalSum: loadAmount,
        salaryPerPercent,
        workers,
      }).save({ session });
    } else {
      salaryRecord.loadedCount = loadedCountFromDeliveries;
      salaryRecord.totalSum = loadAmount;
      salaryRecord.salaryPerPercent = salaryPerPercent;
      salaryRecord.workers = workers;
      await salaryRecord.save({ session });
    }

    if (isNewSession) await session.commitTransaction();
    return { success: true, message: "SalaryRecord yangilandi" };
  } catch (error) {
    if (isNewSession) await session.abortTransaction();
    return { success: false, message: error.message };
  } finally {
    if (isNewSession) session.endSession();
  }
}

// Yordamchi funksiya — berilgan kun va bo‘lim bo‘yicha yetkazilgan yuk miqdorini hisoblaydi
async function getLoadedCountForDepartment(
  department,
  startOfDay,
  endOfDay,
  session
) {
  const sales = await Salecart.find({
    "deliveredItems.deliveryDate": { $gte: startOfDay, $lte: endOfDay },
    "deliveredItems.deliveredGroup": department,
  }).session(session);

  return sales.reduce((count, sale) => {
    const deptItems = sale.deliveredItems.filter(
      (i) => i.department === department
    );
    return count + deptItems.reduce((sum, i) => sum + i.deliveredQuantity, 0);
  }, 0);
}

module.exports = updateSalaryRecordForDate;
