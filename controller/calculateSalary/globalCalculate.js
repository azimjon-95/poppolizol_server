const Attendance = require("../../model/attendanceModal");
const SalaryRecord = require("../../model/salaryRecord");
const ProductionHistory = require("../../model/ProductionHistoryModel");
const { Product: ProductPriceInfo } = require("../../model/factoryModel");

/**
 * Kim bonus olishi kerakligini aniqlash (faqat ruberoid uchun)
 * - foiz > 1
 * - "ish boshqaruvchi" emas
 * - foizi 1.2 emas
 */
function isExtraWorker(attendance) {
  const unit = String(attendance.unit || "").toLowerCase();
  return (
    attendance.percentage > 1 &&
    !unit.includes("ish boshqaruvchi") &&
    attendance.percentage !== 1.2
  );
}

/**
 * Unit nomini canonical formatga keltiramiz:
 * ruberoid / polizol / okisleniya / boshqalar
 */
function getCanonicalUnit(unit) {
  const u = String(unit || "").toLowerCase();

  if (u.includes("rubiroid") || u.includes("ruberoid")) return "ruberoid";
  if (u.includes("okisleniya")) return "okisleniya";
  if (u.includes("polizol")) return "polizol";

  return u; // boshqa bo'limlar uchun
}

/**
 * SalaryRecord.department uchun bitta kalit nom
 */
function getDepartmentName(canonicalUnit, rawUnit) {
  switch (canonicalUnit) {
    case "okisleniya":
      return "Okisleniya";
    case "polizol":
      return "polizol";
    case "ruberoid":
      return "ruberoid";
    default:
      return rawUnit || canonicalUnit;
  }
}

async function reCalculateGlobalSalaries(unit, date, session) {
  const rawUnit = String(unit || "").trim();
  const canonicalUnit = getCanonicalUnit(rawUnit);

  // Sana oraliqlarini tayyorlash (kun boshidan oxirigacha)
  const today = new Date(date);
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Davomatda qaysi unit bo'yicha qidiramiz
  let searchUnit;
  if (canonicalUnit === "ruberoid") {
    searchUnit = { $in: [/rubiroid/i, /ruberoid/i] };
  } else if (canonicalUnit === "okisleniya") {
    searchUnit = /okisleniya/i;
  } else if (canonicalUnit === "polizol") {
    searchUnit = /polizol/i;
  } else {
    // fallback – unit nomi bo'yicha regex
    searchUnit = new RegExp(rawUnit || canonicalUnit, "i");
  }

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

  // Jami foiz
  const totalPercentage = todayAttendances.reduce(
    (sum, a) => sum + (a.percentage || 0),
    0
  );

  const department = getDepartmentName(canonicalUnit, rawUnit);

  // Shu kun va shu bo'lim uchun SalaryRecord izlaymiz
  let salaryRecord = await SalaryRecord.findOne({
    date: { $gte: today, $lte: endOfDay },
    department,
  }).session(session);

  // Topilmasa – yangisini yaratamiz
  if (!salaryRecord) {
    salaryRecord = new SalaryRecord({
      date: today,
      department,
      workers: [],
    });
  }

  // cleaning turidagi salaryRecord ni bu funksiya qayta hisoblamaydi
  if (salaryRecord.type === "cleaning") {
    return salaryRecord;
  }

  const prices = await ProductPriceInfo.find().session(session);

  let totalSum = 0;
  let salaryPerPercent = 0;

  /**
   * 1) POLIZOL
   * producedCount * Polizol.productionCost
   */
  if (canonicalUnit === "polizol") {
    const unitProductionPrice =
      prices.find((p) => p.category === "Polizol")?.productionCost || 0;
    totalSum = (salaryRecord.producedCount || 0) * unitProductionPrice;

    salaryPerPercent = totalPercentage ? totalSum / totalPercentage : 0;
  }

  /**
   * 2) OKISLENIYA
   *  - Bn_3 * loadingCost
   *  - Bn_5 * productionCost
   *  - Bn_5_mel * productionCost
   */
  if (canonicalUnit === "okisleniya") {
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

    salaryPerPercent = totalPercentage ? totalSum / totalPercentage : 0;
  }

  /**
   * 3) RUBEROID
   *  - ProductionHistory dan bugungi ruberoid mahsulotlar summasi
   *  - Extra ishchilar uchun bonus (100 000) alohida ajratiladi
   *  - totalSum > 0 bo'lsa:
   *      distributable = max(totalSum - bonuslar, 0)
   *      salaryPerPercent = distributable / totalPercentage
   *    totalSum = 0 bo'lsa:
   *      salaryPerPercent = 0, faqat bonuslar beriladi, minus bo'lmaydi
   */
  if (canonicalUnit === "ruberoid") {
    const todayFinishedProducts = await ProductionHistory.find({
      date: { $gte: today, $lte: endOfDay },
      products: {
        $elemMatch: { productName: { $regex: /ruberoid/i } },
      },
    }).session(session);

    const products = todayFinishedProducts.flatMap((i) => i.products || []);

    for (const item of products) {
      const price =
        prices.find(
          (p) => p.category === "Ruberoid" && p.name === item.productName
        )?.productionCost || 0;

      totalSum += (item.quantityProduced || 0) * price;
    }

    const bonusPerExtra = 100000;
    const extraWorkers = todayAttendances.filter(isExtraWorker);
    const extraTotal = extraWorkers.length * bonusPerExtra;

    if (totalSum > 0 && totalPercentage > 0) {
      const distributable = Math.max(totalSum - extraTotal, 0);
      salaryPerPercent = distributable / totalPercentage;
    } else {
      // Ishlab chiqarishdan umuman pul bo'lmasa – minus bo'lmaydi
      salaryPerPercent = 0;
    }
  }

  /**
   * Agar canonicalUnit polizol/okisleniya/ruberoid bo'lmasa,
   * yoki yuqorida totalSum hisoblangan bo'lmasa,
   * default formulani qo'llash mumkin bo'lsa:
   */
  if (
    canonicalUnit !== "ruberoid" &&
    canonicalUnit !== "polizol" &&
    canonicalUnit !== "okisleniya"
  ) {
    // Agar siz umumiy boshqa bo'limlar uchun ham totalSum ni hisoblasangiz,
    // shu yerda qo'shishingiz mumkin. Hozircha totalSum default 0.
    salaryPerPercent = totalPercentage ? totalSum / totalPercentage : 0;
  }

  /**
   * Ishchilar ro'yxatini qayta qurish
   *  - faqat bugungi davomatdagi ishchilar qoladi
   *  - mavjud ishchi uchun amountOfLoaded saqlanadi
   *  - ruberoid bo'limida extra ishchilarga 100 000 bonus qo'shiladi
   */
  const bonusPerExtra = 100000;
  const newWorkers = todayAttendances.map((a) => {
    const existingWorker = salaryRecord.workers.find(
      (w) => w.employee.toString() === a.employee._id.toString()
    );

    const baseAmount = Math.round(salaryPerPercent * (a.percentage || 0));

    let bonus = 0;
    if (canonicalUnit === "ruberoid" && isExtraWorker(a)) {
      bonus = bonusPerExtra;
    }

    const newAmount = baseAmount + bonus;

    return {
      employee: a.employee._id,
      percentage: a.percentage,
      amount: newAmount,
      amountOfLoaded: existingWorker ? existingWorker.amountOfLoaded || 0 : 0,
    };
  });

  salaryRecord.workers = newWorkers;
  salaryRecord.totalSum = totalSum;
  salaryRecord.totalPercentage = totalPercentage;
  salaryRecord.salaryPerPercent = salaryPerPercent;

  await salaryRecord.save({ session });

  return salaryRecord;
}

module.exports = reCalculateGlobalSalaries;
