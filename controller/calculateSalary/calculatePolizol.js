// ✅ Qo‘shilgan: Polizol ish haqi hisoblash funktsiyasi
const Attendance = require("../../model/attendanceModal");
const SalaryRecord = require("../../model/salaryRecord");

async function calculatePolizolSalaries({
  producedCount,
  loadedCount = 0,
  session,
}) {
  const today = new Date();

  // 1. Bugungi polizol bo‘limidagi ishchilar davomatini olish
  const todayAttendances = await Attendance.find({
    date: {
      $gte: new Date(today.setHours(0, 0, 0, 0)),
      $lte: new Date(today.setHours(23, 59, 59, 999)),
    },
    department: "polizol",
  })
    .populate("employee")
    .session(session);

  if (todayAttendances.length === 0) return null;

  const unitProductionPrice = 2800;
  const unitLoadPrice = 400;
  const totalProductionAmount = producedCount * unitProductionPrice;
  const totalLoadAmount = loadedCount * unitLoadPrice;
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



module.exports = calculatePolizolSalaries;
