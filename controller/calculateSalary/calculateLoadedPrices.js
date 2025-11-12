const Attendance = require("../../model/attendanceModal");
const SalaryRecord = require("../../model/salaryRecord");
const Salecart = require("../../model/saleCartSchema");
const { Product: ProductPriceInfo } = require("../../model/factoryModel");
const FinishedProduct = require("../../model/finishedProductModel");
const Admins = require("../../model/adminModel");
const mongoose = require("mongoose");

async function calculateLoadedPrices(date, externalSession) {
  const session = externalSession || (await mongoose.startSession());
  const isNewSession = !externalSession;

  if (isNewSession) session.startTransaction();

  try {
    // Sana va vaqt
    const baseDate =
      date && !isNaN(new Date(date).getTime()) ? new Date(date) : new Date();
    baseDate.setHours(0, 0, 0, 0);
    const startOfDay = baseDate;
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    // Kunlik sotuvlarni olish
    const sales = await Salecart.Salecart.find({
      "deliveredItems.deliveryDate": { $gte: startOfDay, $lte: endOfDay },
    })
      .select("deliveredItems")
      .lean()
      .session(session);

    const totalSalesData = (sales || [])
      .flatMap((sale) =>
        Array.isArray(sale.deliveredItems) ? sale.deliveredItems : []
      )
      .filter(
        (i) => startOfDay <= i.deliveryDate && i.deliveryDate <= endOfDay
      );

    // Boshqaruvchilar
    const managerialUnits = [
      "polizol ish boshqaruvchi",
      "rubiroid ish boshqaruvchi",
      "ruberoid ish boshqaruvchi",
      "Okisleniya ish boshqaruvchi",
    ];

    const bolimBoshliqlari = await Admins.find({
      unit: { $in: managerialUnits },
    }).session(session);

    // 🔑 Avval barcha SalaryRecordlarni toza qilish (faqat loaded qismi)
    const existingSalaryRecords = await SalaryRecord.find({
      date: { $gte: startOfDay, $lte: endOfDay },
    }).session(session);

    for (const sr of existingSalaryRecords) {
      sr.loadedCount = 0;
      sr.loadedCountKg = 0;
      sr.totalSum = 0;
      sr.salaryPerPercent = 0;
      sr.workers = sr.workers.map((w) => ({
        ...w.toObject(),
        amountOfLoaded: 0, // yuklama nolga tushadi
      }));
      await sr.save({ session });
    }

    // Endi barcha yuklamalarni qayta hisoblaymiz
    for (const item of totalSalesData) {
      let loadAmount = 0;

      // Mahsulot ma'lumotlari
      const product = await FinishedProduct.findById(item.productId).session(
        session
      );
      if (product) {
        const priceInfo = await ProductPriceInfo.findOne({
          category: { $regex: `^${product.category}$`, $options: "i" },
          name: { $regex: `^${product.productName}$`, $options: "i" },
        }).session(session);
        if (priceInfo) {
          loadAmount = priceInfo.loadingCost * item.deliveredQuantity;
        }
      }

      // Guruhlarni normallashtirish
      const correctedDeliveredGroups = [
        ...new Set(
          item.deliveredGroups.map((group) =>
            group
              .toLowerCase()
              .replace(/rubiroid|ruberoid/i, "ruberoid")
              .replace(/polizol/i, "polizol")
              .replace(/okisleniya/i, "Okisleniya")
          )
        ),
      ];

      const unitRegexArray = correctedDeliveredGroups
        .map((i) => (i === "ruberoid" ? "rubiroid" : i))
        .map((group) => new RegExp(group, "i"));

      const baseAttendanceQuery = {
        date: { $gte: startOfDay, $lte: endOfDay },
        percentage: startOfDay.getHours() >= 12 ? { $gt: 0.5 } : { $gt: 0 },
        unit: { $in: unitRegexArray },
      };

      let totalAttendances = await Attendance.find(baseAttendanceQuery).session(
        session
      );

      totalAttendances = totalAttendances.map((item) => ({
        ...item.toObject(),
        unit: item.unit
          .toLowerCase()
          .replace(/rubiroid|ruberoid/i, "ruberoid")
          .replace(/polizol/i, "polizol")
          .replace(/okisleniya/i, "Okisleniya"),
      }));

      const workersData = totalAttendances.map((item) => {
        const isManager = bolimBoshliqlari.some(
          (bolim) => bolim._id.toString() === item.employee.toString()
        );
        return { ...item, salaryPart: isManager ? 1.2 : 1 };
      });

      const totalPercentage = workersData.reduce(
        (sum, worker) => sum + worker.salaryPart,
        0
      );

      for (const dept of correctedDeliveredGroups) {
        const attendances = workersData.filter((att) =>
          att.unit.toLowerCase().includes(dept.toLowerCase())
        );

        if (attendances.length === 0) continue;

        const deptPercentage = attendances.reduce(
          (sum, worker) => sum + worker.salaryPart,
          0
        );

        const deptLoadAmount = (loadAmount * deptPercentage) / totalPercentage;

        const salaryPerWorker =
          deptPercentage > 0 ? deptLoadAmount / deptPercentage : 0;

        // deptLoadAmount ning loadAmount ga nisbatan foizini hisoblash
        const deptLoadPercentage = deptLoadAmount / loadAmount;

        // item.deliveredQuantity ning o‘sha foizini hisoblash
        const deptDeliveredQuantity = Math.round(
          item.deliveredQuantity * deptLoadPercentage
        );
        let salaryRecord = await SalaryRecord.findOne({
          date: { $gte: startOfDay, $lte: endOfDay },
          department: dept,
        }).session(session);

        if (!salaryRecord) {
          const workers = attendances.map((att) => ({
            employee: att.employee,
            percentage: att.percentage,
            amount: 0,
            amountOfLoaded: salaryPerWorker * att.salaryPart,
          }));

          salaryRecord = new SalaryRecord({
            date: startOfDay,
            department: dept.toLowerCase().includes("polizol")
              ? "polizol"
              : dept,
            producedCount: 0,
            // loadedCount: item.deliveredQuantity,
            loadedCount:
              item.productName?.toLowerCase().includes("polizol") ||
              item.productName?.toLowerCase().includes("folygoizol") ||
              item.productName?.toLowerCase().includes("ruberoid")
                ? deptDeliveredQuantity
                : 0,
            totalSum: deptLoadAmount,
            loadedCountKg:
              !item.productName?.toLowerCase().includes("polizol") &&
              !item.productName?.toLowerCase().includes("folygoizol") &&
              !item.productName?.toLowerCase().includes("ruberoid")
                ? deptDeliveredQuantity
                : 0,
            salaryPerPercent: salaryPerWorker,
            workers,
          });
        } else {
          const newWorkers = attendances.map((att) => {
            const prevWorker = salaryRecord.workers.find(
              (w) => w.employee.toString() === att.employee.toString()
            );

            return {
              employee: att.employee,
              percentage: att.percentage,
              amount: prevWorker?.amount || 0,
              amountOfLoaded:
                (prevWorker?.amountOfLoaded || 0) +
                salaryPerWorker * att.salaryPart,
            };
          });

          salaryRecord.workers = newWorkers;
          // salaryRecord.loadedCount =
          //   (salaryRecord.loadedCount || 0) + item.deliveredQuantity;
          salaryRecord.loadedCount =
            (salaryRecord.loadedCount || 0) +
            (item.productName?.toLowerCase().includes("polizol") ||
            item.productName?.toLowerCase().includes("folygoizol") ||
            item.productName?.toLowerCase().includes("ruberoid")
              ? deptDeliveredQuantity
              : 0);
          // salaryRecord.totalSum = (salaryRecord.totalSum || 0) + deptLoadAmount;
          // salaryRecord.salaryPerPercent = salaryPerWorker;
          salaryRecord.totalSum = (salaryRecord.totalSum || 0) + deptLoadAmount;
          salaryRecord.loadedCountKg =
            (salaryRecord.loadedCountKg || 0) +
            (!item.productName?.toLowerCase().includes("polizol") &&
            !item.productName?.toLowerCase().includes("folygoizol") &&
            !item.productName?.toLowerCase().includes("ruberoid")
              ? deptDeliveredQuantity
              : 0);
        }

        await salaryRecord.save({ session });
      }
    }

    if (isNewSession) await session.commitTransaction();
  } catch (error) {
    if (isNewSession) await session.abortTransaction();
    throw error;
  } finally {
    if (isNewSession) session.endSession();
  }
}

module.exports = calculateLoadedPrices;
