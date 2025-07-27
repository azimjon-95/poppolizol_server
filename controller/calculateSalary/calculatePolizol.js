const Attendance = require("../../model/attendanceModal");
const SalaryRecord = require("../../model/salaryRecord");

async function calculatePolizolSalaries({
  producedCount,
  loadedCount = 0,
  session,
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today.getTime() + 86399999); // 23:59:59

  // 1. Bugungi davomatlar
  const todayAttendances = await Attendance.find({
    date: { $gte: today, $lte: endOfDay },
    unit: "polizol",
  })
    .populate("employee")
    .session(session);

  if (todayAttendances.length === 0) return null;

  // 2. Ish haqi birlik narxlari
  const unitProductionPrice = 2800;
  const unitLoadPrice = 400;

  // 3. Mavjud SalaryRecord ni qidirish
  let salaryRecord = await SalaryRecord.findOne({
    date: { $gte: today, $lte: endOfDay },
    department: "polizol",
  }).session(session);

  let currentProducedCount = salaryRecord?.producedCount || 0;
  let currentLoadedCount = salaryRecord?.loadedCount || 0;

  // 4. Yangi jami qiymatlar
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

  // 5. Yangilash yoki yaratish
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
          date: new Date(),
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
  const targetDate = new Date(inputDate);
  targetDate.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate.getTime() + 86399999);

  // 1. Davomatlar
  const attendances = await Attendance.find({
    date: { $gte: targetDate, $lte: endOfDay },
    unit: "polizol",
  })
    .populate("employee")
    .session(session);

  if (attendances.length === 0) {
    console.log("Davomat topilmadi, hisoblash bekor qilindi:", inputDate);
    return null;
  }

  // 2. SalaryRecord bor-yo‘qligini aniqlash
  let salaryRecord = await SalaryRecord.findOne({
    date: { $gte: targetDate, $lte: endOfDay },
    department: "polizol",
  }).session(session);

  const producedCount = salaryRecord?.producedCount || 0;
  const loadedCount = salaryRecord?.loadedCount || 0;

  const unitProductionPrice = 2800;
  const unitLoadPrice = 400;

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
    // 3. Mavjud bo‘lsa yangilash
    salaryRecord.totalSum = totalSum;
    salaryRecord.salaryPerPercent = salaryPerPercent;
    salaryRecord.workers = workers;

    await salaryRecord.save({ session });
  } else {
    // 4. Yangi SalaryRecord yaratish
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

  console.log("✅ SalaryRecord qayta hisoblandi:", inputDate);
}

module.exports = {
  calculatePolizolSalaries,
  recalculatePolizolSalaries,
};
