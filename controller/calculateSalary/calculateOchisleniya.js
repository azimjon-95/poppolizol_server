const Attendance = require("../../model/attendanceModal");
const SalaryRecord = require("../../model/salaryRecord");

const calculateOchisleniya = async (btm3, btm5, inputDate, session = null) => {
  const targetDate = new Date(inputDate);
  targetDate.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate.getTime() + 86399999);

  // 1. Davomat olish (faqat ochisleniya bo‘limi)
  const attendances = await Attendance.find({
    date: { $gte: targetDate, $lte: endOfDay },
    unit: "ochisleniya",
  })
    .populate("employee")
    .session(session);

  if (attendances.length === 0) {
    console.log("Davomat topilmadi: ochisleniya");
    return null;
  }

  // 2. Ish haqi summasini hisoblash
  const btm3Salary = btm3 * 25;
  const btm5Salary = btm5 * 70;
  const totalSalary = btm3Salary + btm5Salary;

  // 3. Umumiy foiz
  const totalPercentage = attendances.reduce((sum, a) => sum + a.percentage, 0);

  const salaryPerPercent = totalSalary / totalPercentage;

  // 4. Ishchilarga taqsimlash
  const workers = attendances.map((a) => ({
    employee: a.employee._id,
    percentage: a.percentage,
    amount: Math.round(salaryPerPercent * a.percentage),
  }));

  // 5. SalaryRecord bor yoki yo‘qligini tekshirish
  let salaryRecord = await SalaryRecord.findOne({
    date: { $gte: targetDate, $lte: endOfDay },
    department: "ochisleniya",
  }).session(session);

  if (salaryRecord) {
    // Update
    salaryRecord.producedCount = btm3;
    salaryRecord.loadedCount = btm5;
    salaryRecord.totalSum = totalSalary;
    salaryRecord.salaryPerPercent = salaryPerPercent;
    salaryRecord.workers = workers;

    await salaryRecord.save({ session });
  } else {
    // Create
    await SalaryRecord.create(
      [
        {
          date: targetDate,
          department: "ochisleniya",
          producedCount: btm3,
          loadedCount: btm5,
          totalSum: totalSalary,
          salaryPerPercent,
          workers,
        },
      ],
      { session }
    );
  }
};

module.exports = { calculateOchisleniya };
