const moment = require("moment-timezone");
const Attendance = require("../../model/attendanceModal");
const SalaryRecord = require("../../model/salaryRecord");

const { Product: ProductPriceInfo } = require("../../model/factoryModel");

const TIMEZONE = "Asia/Tashkent";

function getDayRange(dateInput) {
  const date = moment.tz(dateInput, TIMEZONE);
  const start = date.clone().startOf("day").toDate();
  const end = date.clone().endOf("day").toDate();
  return { start, end };
}

async function calculatePolizolSalaries({
  producedCount,
  loadedCount = 0,
  session,
  date = new Date(),
}) {
  const { start: today, end: endOfDay } = getDayRange(date);

  const todayAttendances = await Attendance.find({
    date: { $gte: today, $lte: endOfDay },
    unit: "polizol",
  })
    .populate("employee")
    .session(session);

  if (todayAttendances.length === 0) return null;

  let prices = await ProductPriceInfo.find({
    category: { $in: ["Polizol"] },
  }).session(session);

  let priceMap = prices.reduce((acc, item) => {
    acc[item.category] = item;
    return acc;
  }, {});

  const unitProductionPrice = priceMap["Polizol"].productionCost;
  const unitLoadPrice = priceMap["Polizol"].loadingCost;

  let salaryRecord = await SalaryRecord.findOne({
    date: { $gte: today, $lte: endOfDay },
    department: "polizol",
  }).session(session);

  const currentProducedCount = salaryRecord?.producedCount || 0;
  const currentLoadedCount = salaryRecord?.loadedCount || 0;

  const newProducedCount = currentProducedCount + producedCount;
  const newLoadedCount = currentLoadedCount + loadedCount;

  const totalProductionAmount = newProducedCount * unitProductionPrice;
  const totalLoadAmount = newLoadedCount * unitLoadPrice;
  const totalSum = totalProductionAmount + totalLoadAmount;

  const totalPercentage = todayAttendances.reduce(
    (sum, a) => sum + a.percentage,
    0
  );
  const salaryPerPercent = totalSum / totalPercentage;

  const workers = todayAttendances.map((a) => ({
    employee: a.employee._id,
    percentage: a.percentage,
    amount: Math.round(salaryPerPercent * a.percentage),
  }));

  if (salaryRecord) {
    salaryRecord.producedCount = newProducedCount;
    salaryRecord.loadedCount = newLoadedCount;
    salaryRecord.totalSum = totalSum;
    salaryRecord.salaryPerPercent = salaryPerPercent;
    salaryRecord.workers = workers;
    await salaryRecord.save({ session });
  } else {
    await SalaryRecord.create(
      [
        {
          date: today, // bu yerda aniq Asia/Tashkent 00:00:00 bo‘yicha saqlanadi
          department: "polizol",
          producedCount,
          loadedCount,
          totalSum,
          salaryPerPercent,
          workers,
        },
      ],
      { session }
    );
  }
}

async function recalculatePolizolSalaries(inputDate, session = null) {
  const { start: targetDate, end: endOfDay } = getDayRange(inputDate);

  const attendances = await Attendance.find({
    date: { $gte: targetDate, $lte: endOfDay },
    unit: "polizol",
  })
    .populate("employee")
    .session(session);

  if (attendances.length === 0) {
    console.log("❌ Davomat topilmadi:", inputDate);
    return null;
  }

  let salaryRecord = await SalaryRecord.findOne({
    date: { $gte: targetDate, $lte: endOfDay },
    department: "polizol",
  }).session(session);

  const producedCount = salaryRecord?.producedCount || 0;
  const loadedCount = salaryRecord?.loadedCount || 0;

  // 1. Bitta query bilan barcha kerakli narxlarni olish

  let prices = await ProductPriceInfo.find({
    category: { $in: ["Polizol"] },
  }).session(session);

  let priceMap = prices.reduce((acc, item) => {
    acc[item.category] = item;
    return acc;
  }, {});

  const unitProductionPrice = priceMap["Polizol"].productionCost;
  const unitLoadPrice = priceMap["Polizol"].loadingCost;

  const totalProductionAmount = producedCount * unitProductionPrice;
  const totalLoadAmount = loadedCount * unitLoadPrice;
  const totalSum = totalProductionAmount + totalLoadAmount;

  const totalPercentage = attendances.reduce((sum, a) => sum + a.percentage, 0);
  const salaryPerPercent = totalSum / totalPercentage;

  const workers = attendances.map((a) => ({
    employee: a.employee._id,
    percentage: a.percentage,
    amount: Math.round(salaryPerPercent * a.percentage),
  }));

  if (salaryRecord) {
    salaryRecord.totalSum = totalSum;
    salaryRecord.salaryPerPercent = salaryPerPercent;
    salaryRecord.workers = workers;
    await salaryRecord.save({ session });
  } else {
    await SalaryRecord.create(
      [
        {
          date: targetDate,
          department: "polizol",
          producedCount,
          loadedCount,
          totalSum,
          salaryPerPercent,
          workers,
        },
      ],
      { session }
    );
  }
}

module.exports = {
  calculatePolizolSalaries,
  recalculatePolizolSalaries,
};
