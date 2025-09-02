// const moment = require("moment-timezone");
// const Attendance = require("../../model/attendanceModal");
// const SalaryRecord = require("../../model/salaryRecord");
// const FinishedProduct = require("../../model/finishedProductModel");
// const { Product: ProductPriceInfo } = require("../../model/factoryModel");
// const TIMEZONE = "Asia/Tashkent";

// function getDayRange(dateInput) {
//   const date = moment.tz(dateInput, TIMEZONE);
//   const start = date.clone().startOf("day").toDate();
//   const end = date.clone().endOf("day").toDate();
//   return { start, end };
// }

// async function reCalculateGlobalSalaries(unit, date, session) {
//   console.log("222", unit);

//   const { start: today, end: endOfDay } = getDayRange(date);
//   const todayAttendances = await Attendance.find({
//     date: { $gte: today, $lte: endOfDay },
//     unit: unit,
//   })
//     .populate("employee")
//     .session(session);

//   if (!todayAttendances.length) return null;

//   const totalPercentage = todayAttendances.reduce(
//     (sum, a) => sum + a.percentage,
//     0
//   );

//   let salaryRecord = await SalaryRecord.findOne({
//     date: { $gte: today, $lte: endOfDay },
//     department: unit,
//   }).session(session);

//   if (!salaryRecord) {
//     salaryRecord = new SalaryRecord({
//       date: today,
//       department: unit,
//     });
//   }

//   let prices = await ProductPriceInfo.find().session(session);

//   let totalSum = 0;
//   let workers = [];
//   let salaryPerPercent = 0;

//   if (unit === "polizol") {
//     const unitProductionPrice = prices.find(
//       (p) => p.category === "Polizol"
//     ).productionCost;

//     console.log("price", unitProductionPrice);
//     console.log(" salaryRecord.producedCount", salaryRecord.producedCount);

//     totalSum = salaryRecord.producedCount * unitProductionPrice;
//     console.log("totalSum", totalSum);
//   }
//   if (unit === "Okisleniya") {
//     let btm3Price = prices.find((p) => p.category === "Bn_3").loadingCost;
//     let btm5Price = prices.find((p) => p.category === "Bn_5").loadingCost;
//     let btm5MelPrice = prices.find(
//       (p) => p.category === "Bn_5_mel"
//     ).productionCost;

//     const btm3Salary = (salaryRecord.btm_3 || 0) * (btm3Price || 0);

//     const btm5Salary = (salaryRecord.btm_5 || 0) * (btm5Price || 0);

//     const btm5SaleSalary = (salaryRecord.btm_5_sale || 0) * (btm5MelPrice || 0);

//     totalSum = btm3Salary + btm5Salary + btm5SaleSalary;
//   }
//   salaryPerPercent = totalSum / totalPercentage;
//   workers = todayAttendances.map((a) => ({
//     employee: a.employee._id,
//     percentage: a.percentage,
//     amount: Math.round(salaryPerPercent * a.percentage),
//   }));

//   if (unit === "ruberoid") {
//     let todayFinishedProducts = await FinishedProduct.find({
//       productionDate: { $gte: today, $lte: endOfDay },
//       productName: {
//         $in: ["Ruberoid"],
//       },
//     }).session(session);

//     for (const item of todayFinishedProducts) {
//       let price = prices.find(
//         (p) => p.category === "Ruberoid" && p.name === item.productName
//       ).productionCost;
//       totalSum += item.quantity * price;
//     }

//     const bonusPerExtra = 100000;
//     const extraWorkers = todayAttendances.filter((a) => a.percentage > 1);
//     const extraTotal = extraWorkers.length * bonusPerExtra;
//     const distributable = totalSum - extraTotal; // ✅

//     // 5. Ish haqi hisoblash
//     const totalPercentage = todayAttendances.reduce(
//       (sum, a) => sum + a.percentage,
//       0
//     );
//     const salaryPerPercent = totalPercentage
//       ? distributable / totalPercentage
//       : 0;

//     workers = todayAttendances.map((a) => {
//       const base = Math.round(salaryPerPercent * a.percentage);
//       const bonus = a.percentage > 1 ? bonusPerExtra : 0;
//       return {
//         employee: a.employee._id,
//         percentage: a.percentage,
//         amount: base + bonus,
//       };
//     });
//   }

//   salaryRecord.totalSum = totalSum;
//   salaryRecord.totalPercentage = totalPercentage;
//   salaryRecord.workers = salaryRecord.workers.map((w) => {
//     let exactWorkerinWorkers = workers.find((w2) =>
//       w2.employee.equals(w.employee)
//     );
//     return {
//       employee: w.employee,
//       percentage: w.percentage,
//       amount:
//         w.amount + (exactWorkerinWorkers ? exactWorkerinWorkers.amount : 0),
//     };
//   });
//   await salaryRecord.save({ session });
// }

// module.exports = reCalculateGlobalSalaries;

const moment = require("moment-timezone");
const Attendance = require("../../model/attendanceModal");
const SalaryRecord = require("../../model/salaryRecord");
const FinishedProduct = require("../../model/finishedProductModel");
const { Product: ProductPriceInfo } = require("../../model/factoryModel");
const TIMEZONE = "Asia/Tashkent";

function getDayRange(dateInput) {
  const date = moment.tz(dateInput, TIMEZONE);
  const start = date.clone().startOf("day").toDate();
  const end = date.clone().endOf("day").toDate();
  return { start, end };
}

async function reCalculateGlobalSalaries(unit, date, session) {
  console.log("22222>>>>", unit);

  const { start: today, end: endOfDay } = getDayRange(date);
  const todayAttendances = await Attendance.find({
    date: { $gte: today, $lte: endOfDay },
    unit: unit === "ruberoid" ? "rubiroid" : unit,
  })
    .populate("employee")
    .session(session);

  if (!todayAttendances.length) return null;

  const totalPercentage = todayAttendances.reduce(
    (sum, a) => sum + a.percentage,
    0
  );

  let salaryRecord = await SalaryRecord.findOne({
    date: { $gte: today, $lte: endOfDay },
    department: unit,
  }).session(session);

  if (!salaryRecord) {
    salaryRecord = new SalaryRecord({
      date: today,
      department: unit,
    });
  }

  const prices = await ProductPriceInfo.find().session(session);

  let totalSum = 0;
  let workers = [];
  let salaryPerPercent = 0;

  if (unit === "polizol") {
    const unitProductionPrice =
      prices.find((p) => p.category === "Polizol")?.productionCost || 0;

    totalSum = (salaryRecord.producedCount || 0) * unitProductionPrice;
  }

  if (unit === "Okisleniya") {
    const btm3Price =
      prices.find((p) => p.category === "Bn_3")?.loadingCost || 0;
    const btm5Price =
      prices.find((p) => p.category === "Bn_5")?.loadingCost || 0;
    const btm5MelPrice =
      prices.find((p) => p.category === "Bn_5_mel")?.productionCost || 0;

    const btm3Salary = (salaryRecord.btm_3 || 0) * btm3Price;
    const btm5Salary = (salaryRecord.btm_5 || 0) * btm5Price;
    const btm5SaleSalary = (salaryRecord.btm_5_sale || 0) * btm5MelPrice;

    totalSum = btm3Salary + btm5Salary + btm5SaleSalary;
  }

  salaryPerPercent = totalPercentage ? totalSum / totalPercentage : 0;

  workers = todayAttendances.map((a) => ({
    employee: a.employee._id,
    percentage: a.percentage,
    amount: Math.round(salaryPerPercent * a.percentage),
  }));

  if (unit === "ruberoid") {
    console.log("ok ruberoid");

    const todayFinishedProducts = await FinishedProduct.find({
      productionDate: { $gte: today, $lte: endOfDay },
      productName: { $in: ["Ruberoid"] },
    }).session(session);
    console.log("todayFinishedProducts", todayFinishedProducts);

    for (const item of todayFinishedProducts) {
      const price =
        prices.find(
          (p) => p.category === "Ruberoid" && p.name === item.productName
        )?.productionCost || 0;
      totalSum += item.quantity * price;
    }

    const bonusPerExtra = 100000;
    const extraWorkers = todayAttendances.filter((a) => a.percentage > 1);
    const extraTotal = extraWorkers.length * bonusPerExtra;
    const distributable = totalSum - extraTotal;

    const totalPercentageRub = todayAttendances.reduce(
      (sum, a) => sum + a.percentage,
      0
    );

    const salaryPerPercentRub = totalPercentageRub
      ? distributable / totalPercentageRub
      : 0;

    workers = todayAttendances.map((a) => {
      const base = Math.round(salaryPerPercentRub * a.percentage);
      const bonus = a.percentage > 1 ? bonusPerExtra : 0;
      return {
        employee: a.employee._id,
        percentage: a.percentage,
        amount: base + bonus,
      };
    });

    salaryPerPercent = salaryPerPercentRub;
  }

  // ✅ faqat yangidan hisoblangan qiymatlar yoziladi
  salaryRecord.totalSum = totalSum;
  salaryRecord.totalPercentage = totalPercentage;
  salaryRecord.salaryPerPercent = salaryPerPercent;
  salaryRecord.workers = workers;

  await salaryRecord.save({ session });
}

module.exports = reCalculateGlobalSalaries;
