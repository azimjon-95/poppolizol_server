const moment = require("moment-timezone");
const Attendance = require("../../model/attendanceModal");
const SalaryRecord = require("../../model/salaryRecord");
const Normas = require("../../model/productNormaSchema");
const { Product: ProductPriceInfo } = require("../../model/factoryModel");

const TIMEZONE = "Asia/Tashkent";

async function calculateRuberoidSalaries({
  producedCount,
  product_id,
  date,
  session,
}) {
  try {
    // 1. Sana oraliqlarini belgilaymiz
    const start = moment.tz(date, TIMEZONE).startOf("day").toDate();
    const end = moment.tz(date, TIMEZONE).endOf("day").toDate();

    // 2. Bugungi davomatlar
    const attendances = await Attendance.find({
      date: { $gte: start, $lte: end },
      unit: "rubiroid",
    })
      .populate("employee")
      .session(session);

    if (!attendances.length) {
      console.warn("📛 Davomat topilmadi");
      return null;
    }

    // 3. Mahsulotni aniqlaymiz
    const product = await Normas.findById(product_id).session(session);
    if (!product) {
      return null;
    }

    const name = product.productName?.trim();
    let productInfo = await ProductPriceInfo.findOne({
      category: "Ruberoid",
      name: name,
    });
    // const price_2000 = new Set([
    //   "Ruberoid RKP-250 9m (Yupqa)",
    //   "Ruberoid RKP-250 10m (Yupqa)",
    //   "Ruberoid RKP-300 9m (O‘rta)",
    //   "Ruberoid RKP-350 10m (Qalin)",
    // ]);
    // const price_3000 = new Set([
    //   "Ruberoid RKP-250 15m (Yupqa)",
    //   "Ruberoid RKP-300 15m (O‘rta)",
    //   "Ruberoid RKP-350 15m (Qalin)",
    // ]);

    let unitPrice = productInfo.productionCost || 0;
    // if (price_2000.has(name)) unitPrice = 2000;
    // else if (price_3000.has(name)) unitPrice = 3000;
    // else {
    //   console.warn("📛 Narx belgilanmagan mahsulot:", name);
    //   return null;
    // }

    const totalPrice = producedCount * unitPrice;

    // 4. Bonusli ishchilar
    const bonusPerExtra = 100000;
    const extraWorkers = attendances.filter((a) => a.percentage > 1);
    const extraTotal = extraWorkers.length * bonusPerExtra;
    const distributable = totalPrice - extraTotal;

    if (distributable < 0) {
      console.warn("📛 Bonus umumiy summadan katta, hisoblab bo‘lmaydi.");
      return null;
    }

    // 5. Ish haqi hisoblash
    const totalPercentage = attendances.reduce(
      (sum, a) => sum + a.percentage,
      0
    );
    const salaryPerPercent = totalPercentage
      ? distributable / totalPercentage
      : 0;

    const workers = attendances.map((a) => {
      const base = Math.round(salaryPerPercent * a.percentage);
      const bonus = a.percentage > 1 ? bonusPerExtra : 0;
      return {
        employee: a.employee._id,
        percentage: a.percentage,
        amount: base + bonus,
      };
    });

    // 6. SalaryRecord yaratish yoki yangilash
    let salaryRecord = await SalaryRecord.findOne({
      date: { $gte: start, $lte: end },
      department: "ruberoid",
    }).session(session);

    if (salaryRecord) {
      salaryRecord.producedCount = producedCount;
      salaryRecord.totalSum = totalPrice;
      salaryRecord.salaryPerPercent = salaryPerPercent;
      salaryRecord.workers = workers;
      await salaryRecord.save({ session });
    } else {
      await SalaryRecord.create(
        [
          {
            date: start,
            department: "ruberoid",
            producedCount,
            totalSum: totalPrice,
            salaryPerPercent,
            workers,
          },
        ],
        { session }
      );
    }
    return true;
  } catch (err) {
    console.error("❌ Ruberoid ish haqi hisoblashda xatolik:", err);
    return null;
  }
}

async function reCalculateRuberoidSalaries({ date, session }) {
  try {
    // 1. Sana oraliqlari
    const start = moment.tz(date, TIMEZONE).startOf("day").toDate();
    const end = moment.tz(date, TIMEZONE).endOf("day").toDate();

    // 2. Davomatni olish
    const attendances = await Attendance.find({
      date: { $gte: start, $lte: end },
      unit: "rubiroid",
    })
      .populate("employee")
      .session(session);

    if (!attendances.length) {
      console.warn("📛 Davomat topilmadi");
      return null;
    }

    // 3. Mavjud SalaryRecord topish
    const salaryRecord = await SalaryRecord.findOne({
      date: { $gte: start, $lte: end },
      department: "ruberoid",
    }).session(session);

    if (!salaryRecord) {
      return null;
    }

    const producedCount = salaryRecord.producedCount || 0;
    const product_id = salaryRecord.product_id;
    const product = await Normas.findById(product_id).session(session);

    if (!product) {
      return null;
    }

    let productInfo = await ProductPriceInfo.findOne({
      category: "Ruberoid",
      name: name,
    });

    const name = product.productName?.trim();
    // const price_2000 = new Set([
    //   "Ruberoid RKP-250 9m (Yupqa)",
    //   "Ruberoid RKP-250 10m (Yupqa)",
    //   "Ruberoid RKP-300 9m (O‘rta)",
    //   "Ruberoid RKP-350 10m (Qalin)",
    // ]);
    // const price_3000 = new Set([
    //   "Ruberoid RKP-250 15m (Yupqa)",
    //   "Ruberoid RKP-300 15m (O‘rta)",
    //   "Ruberoid RKP-350 15m (Qalin)",
    // ]);

    // let unitPrice = 0;
    let unitPrice = productInfo.productionCost || 0;

    // if (price_2000.has(name)) unitPrice = 2000;
    // else if (price_3000.has(name)) unitPrice = 3000;
    // else {
    // console.warn("📛 Narx belgilanmagan mahsulot:", name);
    // return null;
    // }

    const totalPrice = producedCount * unitPrice;

    // 4. Bonuslar
    
    const bonusPerExtra = 100000;
    const extraWorkers = attendances.filter((a) => a.percentage > 1);
    const extraTotal = extraWorkers.length * bonusPerExtra;
    const distributable = totalPrice - extraTotal;

    if (distributable < 0) {
      console.warn("📛 Bonus umumiy summadan katta, hisoblab bo‘lmaydi.");
      return null;
    }

    // 5. Ish haqi qayta hisoblash
    const totalPercentage = attendances.reduce(
      (sum, a) => sum + a.percentage,
      0
    );
    const salaryPerPercent = totalPercentage
      ? distributable / totalPercentage
      : 0;

    const workers = attendances.map((a) => {
      const base = Math.round(salaryPerPercent * a.percentage);
      const bonus = a.percentage > 1 ? bonusPerExtra : 0;
      return {
        employee: a.employee._id,
        percentage: a.percentage,
        amount: base + bonus,
      };
    });

    // 6. SalaryRecord yangilash
    salaryRecord.totalSum = totalPrice;
    salaryRecord.salaryPerPercent = salaryPerPercent;
    salaryRecord.workers = workers;
    await salaryRecord.save({ session });

    console.log("✅ Ruberoid ish haqi qayta hisoblandi.");
    return true;
  } catch (err) {
    console.error("❌ Ruberoid qayta hisoblashda xatolik:", err);
    return null;
  }
}

module.exports = {
  calculateRuberoidSalaries,
  reCalculateRuberoidSalaries,
};
