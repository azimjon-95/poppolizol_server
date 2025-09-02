const Attendance = require("../../model/attendanceModal");
const SalaryRecord = require("../../model/salaryRecord");
const { Product: ProductPriceInfo } = require("../../model/factoryModel");

const calculateOchisleniyaBN3 = async (
  btm3,
  btm5,
  inputDate,
  session = null
) => {
  const targetDate = new Date(inputDate);
  targetDate.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate.getTime() + 86399999);

  // 1. Davomat olish (faqat Okisleniya bo‘limi)
  const attendances = await Attendance.find({
    date: { $gte: targetDate, $lte: endOfDay },
    unit: "Okisleniya",
  })
    .populate("employee")
    .session(session);

  if (attendances.length === 0) {
    console.log("Davomat topilmadi: Okisleniya");
    return null;
  }
  // 1. Bitta query bilan barcha kerakli narxlarni olish
  let prices = await ProductPriceInfo.find({
    category: { $in: ["Bn_3", "Bn_5"] },
  }).session(session);

  // 2. Oson ishlatish uchun object qilib olish
  let priceMap = prices.reduce((acc, item) => {
    acc[item.category] = item;
    return acc;
  }, {});

  // 3. Hisoblash
  const btm3Salary = btm3 * (priceMap["Bn_3"]?.loadingCost || 0);
  const btm5Salary = btm5 * (priceMap["Bn_5"]?.productionCost || 0);
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
    department: "Okisleniya",
  }).session(session);

  if (salaryRecord) {
    // Update
    salaryRecord.btm_3 = btm3;
    salaryRecord.btm_5 = btm5;
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
          department: "Okisleniya",
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

const CalculateBN5forSale = async (btm5_sale, inputDate, session = null) => {
  try {
    const targetDate = new Date(inputDate);
    targetDate.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate.getTime() + 86399999);

    // 1. Davomat olish (faqat Okisleniya bo‘limi)
    const attendances = await Attendance.find({
      date: { $gte: targetDate, $lte: endOfDay },
      unit: "Okisleniya",
    })
      .populate("employee")
      .session(session);

    if (attendances.length === 0) {
      console.log("Davomat topilmadi: Okisleniya");
      return null;
    }

    let salaryRecord = await SalaryRecord.findOne({
      date: { $gte: targetDate, $lte: endOfDay },
      department: "Okisleniya",
    }).session(session);

    // 3. Umumiy foiz
    const totalPercentage = attendances.reduce(
      (sum, a) => sum + a.percentage,
      0
    );

    let btm5_mel_sale_price = await ProductPriceInfo.findOne({
      category: "Bn_5_mel",
    }).session(session);
    btm5_mel_sale_price = btm5_mel_sale_price?.productionCost || 0;

    let btmtSalePrice = btm5_sale * btm5_mel_sale_price;
    let totalPrice = salaryRecord?.totalSum || 0 + btmtSalePrice;
    const salaryPerPercent = totalPrice / totalPercentage;

    const workers = attendances.map((a) => ({
      employee: a.employee._id,
      percentage: a.percentage,
      amount: Math.round(salaryPerPercent * a.percentage),
    }));

    if (salaryRecord) {
      salaryRecord.btm_5_sale = btm5_sale;
      salaryRecord.totalSum = totalPrice;
      salaryRecord.salaryPerPercent = salaryPerPercent;
      salaryRecord.workers = workers;
      await salaryRecord.save({ session });
    } else {
      await SalaryRecord.create(
        [
          {
            date: targetDate,
            department: "Okisleniya",
            btm_5_sale: btm5_sale,
            totalSum: totalPrice,
            salaryPerPercent,
            workers,
          },
        ],
        { session }
      );
    }
  } catch (e) {
    console.log(e);
  }
};

// =========================================================
// BN3 ni qayta hisoblash
const reCalculateOkisleniya = async (inputDate, session = null) => {
  const targetDate = new Date(inputDate);
  targetDate.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate.getTime() + 86399999);

  // Mavjud SalaryRecord topish
  const salaryRecord = await SalaryRecord.findOne({
    date: { $gte: targetDate, $lte: endOfDay },
    department: "Okisleniya",
  }).session(session);

  if (!salaryRecord) {
    return null;
  }

  // Davomatni qayta olish
  const attendances = await Attendance.find({
    date: { $gte: targetDate, $lte: endOfDay },
    unit: "Okisleniya",
  })
    .populate("employee")
    .session(session);

  if (attendances.length === 0) {
    console.log("Davomat topilmadi: Okisleniya");
    return null;
  }

  // 1. Kerakli barcha kategoriyalarni bitta query bilan olish
  let prices = await ProductPriceInfo.find({
    category: { $in: ["Bn_3", "Bn_5", "Bn_5_mel"] },
  }).session(session);

  // 2. Oson ishlatish uchun object shakliga o'tkazish
  let priceMap = prices.reduce((acc, item) => {
    acc[item.category] = item;
    return acc;
  }, {});

  // 3. Hisoblash
  const btm3Salary =
    (salaryRecord.btm_3 || 0) * (priceMap["Bn_3"]?.loadingCost || 0);

  const btm5Salary =
    (salaryRecord.btm_5 || 0) * (priceMap["Bn_5"]?.loadingCost || 0);

  const btm5SaleSalary =
    (salaryRecord.btm_5_sale || 0) *
    (priceMap["Bn_5_mel"]?.productionCost || 0);

  const totalSalary = btm3Salary + btm5Salary + btm5SaleSalary;

  const totalPercentage = attendances.reduce((sum, a) => sum + a.percentage, 0);
  const salaryPerPercent = totalSalary / totalPercentage;

  const workers = attendances.map((a) => ({
    employee: a.employee._id,
    percentage: a.percentage,
    amount: Math.round(salaryPerPercent * a.percentage),
  }));

  // Yangilash
  salaryRecord.totalSum = totalSalary;
  salaryRecord.salaryPerPercent = salaryPerPercent;
  salaryRecord.workers = workers;
  await salaryRecord.save({ session });

  console.log("BN3 qayta hisoblandi.");
};

module.exports = {
  calculateOchisleniyaBN3,
  CalculateBN5forSale,
  reCalculateOkisleniya,
};
