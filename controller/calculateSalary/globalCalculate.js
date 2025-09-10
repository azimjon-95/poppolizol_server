const Attendance = require("../../model/attendanceModal");
const SalaryRecord = require("../../model/salaryRecord");
const ProductionHistory = require("../../model/ProductionHistoryModel");
const { Product: ProductPriceInfo } = require("../../model/factoryModel");

async function reCalculateGlobalSalaries(unit, date, session) {
  let today = new Date(date);
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  console.log("unit", unit);

  const normalizedUnit = unit
    .toLowerCase()
    .replace(/rubiroid|ruberoid/i, "ruberoid")
    .replace(/polizol/i, "polizol");

  console.log("normalizedUnit", normalizedUnit);

  const searchUnit =
    normalizedUnit === "ruberoid"
      ? { $in: [/rubiroid/i, /ruberoid/i] } // "rubiroid" va "ruberoid" ni qamrab oladi
      : normalizedUnit.toLowerCase().includes("okisleniya")
      ? /Okisleniya/i
      : /polizol/i; // "polizol" uchun qo‘shimcha moslik

  // Joriy kun davomatini olish
  const todayAttendances = await Attendance.find({
    date: { $gte: today, $lte: endOfDay },
    unit: searchUnit,
  })
    .populate("employee")
    .session(session);

  if (!todayAttendances.length) {
    return null;
  }

  const totalPercentage = todayAttendances.reduce(
    (sum, a) => sum + a.percentage,
    0
  );

  // SalaryRecord uchun bo‘lim nomini normallashtirish
  const department =
    normalizedUnit.toLowerCase() === "okisleniya ish boshqaruvchi"
      ? "Okisleniya"
      : normalizedUnit;

  let salaryRecord = await SalaryRecord.findOne({
    date: { $gte: today, $lte: endOfDay },
    department: department.toLowerCase().includes("okisleniya")
      ? "Okisleniya"
      : department,
  }).session(session);

  if (!salaryRecord) {
    salaryRecord = new SalaryRecord({
      date: today,
      department: department.toLowerCase().includes("okisleniya")
        ? "Okisleniya"
        : department,
      workers: [],
    });
  }

  const prices = await ProductPriceInfo.find().session(session);

  let totalSum = 0;
  let salaryPerPercent = 0;

  // Bo‘lim bo‘yicha totalSum ni hisoblash
  if (normalizedUnit === "polizol") {
    const unitProductionPrice =
      prices.find((p) => p.category === "Polizol")?.productionCost || 0;
    totalSum = (salaryRecord.producedCount || 0) * unitProductionPrice;
  }

  if (
    normalizedUnit.toLowerCase() === "okisleniya" ||
    normalizedUnit.toLowerCase() === "okisleniya ish boshqaruvchi"
  ) {
    const btm3Price =
      prices.find((p) => p.category === "Bn_3")?.loadingCost || 0;
    const btm5Price =
      prices.find((p) => p.category === "Bn_5")?.productionCost || 0;
    const btm5MelPrice =
      prices.find((p) => p.category === "Bn_5_mel")?.productionCost || 0;

    const btm3Salary = (salaryRecord.btm_3 || 0) * btm3Price;
    const btm5Salary = (salaryRecord.btm_5 || 0) * btm5Price;
    const btm5SaleSalary = (salaryRecord.btm_5_sale || 0) * btm5MelPrice;

    totalSum = btm3Salary + btm5Salary + btm5SaleSalary;
  }

  if (normalizedUnit === "ruberoid") {
    const todayFinishedProducts = await ProductionHistory.find({
      date: { $gte: today, $lte: endOfDay },
      products: {
        $elemMatch: { productName: { $regex: /ruberoid/i } },
      },
    }).session(session);

    let data = todayFinishedProducts.flatMap((i) => i.products);

    for (const item of data) {
      const price =
        prices.find(
          (p) => p.category === "Ruberoid" && p.name === item.productName
        )?.productionCost || 0;
      totalSum += item.quantityProduced * price;
    }

    const bonusPerExtra = 100000;
    const extraWorkers = todayAttendances.filter(
      (a) =>
        a.percentage > 1 &&
        !(
          a.unit.toLowerCase().includes("ish boshqaruvchi") &&
          a.percentage === 1.2
        )
    );
    const extraTotal = extraWorkers.length * bonusPerExtra;
    const distributable = totalSum - extraTotal;

    salaryPerPercent = totalPercentage ? distributable / totalPercentage : 0;
  } else {
    salaryPerPercent = totalPercentage ? totalSum / totalPercentage : 0;
  }

  // Ishchilar ro‘yxatini qayta qurish
  const newWorkers = todayAttendances.map((a) => {
    let newAmount = Math.round(salaryPerPercent * a.percentage);

    if (normalizedUnit === "ruberoid") {
      const bonus =
        a.percentage > 1 &&
        !a.unit.toLowerCase().includes("ish boshqaruvchi") &&
        a.percentage !== 1.2
          ? 100000
          : 0;
      newAmount = Math.round(salaryPerPercent * a.percentage) + bonus;
    }

    // Mavjud ishchi uchun amountOfLoaded ni saqlash
    const existingWorker = salaryRecord.workers.find(
      (w) => w.employee.toString() === a.employee._id.toString()
    );

    return {
      employee: a.employee._id,
      percentage: a.percentage,
      amount: newAmount,
      amountOfLoaded: existingWorker ? existingWorker.amountOfLoaded || 0 : 0,
    };
  });

  // Faqat joriy davomatdagi ishchilarni saqlash
  salaryRecord.workers = newWorkers;
  salaryRecord.totalSum = totalSum;
  salaryRecord.totalPercentage = totalPercentage;
  salaryRecord.salaryPerPercent = salaryPerPercent;

  await salaryRecord.save({ session });

  return salaryRecord;
}

module.exports = reCalculateGlobalSalaries;
