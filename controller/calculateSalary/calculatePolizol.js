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

module.exports = calculatePolizolSalaries;
