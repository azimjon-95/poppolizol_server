// const Attendance = require("../../model/attendanceModal");
// const SalaryRecord = require("../../model/salaryRecord");
// const Salecart = require("../../model/saleCartSchema");
// const { Product: ProductPriceInfo } = require("../../model/factoryModel");
// const FinishedProduct = require("../../model/finishedProductModel");
// const Admins = require("../../model/adminModel");
// const mongoose = require("mongoose");

// async function calculateLoadedPrices(date, externalSession) {
//   const session = externalSession || (await mongoose.startSession());
//   let isNewSession = !externalSession;
//   console.log("start");

//   if (isNewSession) session.startTransaction();

//   try {
//     // Sana o‘rnatish
//     let baseDate =
//       date && !isNaN(new Date(date).getTime()) ? new Date(date) : new Date();
//     baseDate.setHours(0, 0, 0, 0);
//     const startOfDay = baseDate;
//     const endOfDay = new Date(startOfDay);
//     endOfDay.setHours(23, 59, 59, 999);
//     const hour = startOfDay.getHours();

//     // Kunlik sotuvlarni olish
//     const sales = await Salecart.Salecart.find({
//       "deliveredItems.deliveryDate": { $gte: startOfDay, $lte: endOfDay },
//     })
//       .select("deliveredItems")
//       .lean()
//       .session(session);

//     // Yetkazilgan mahsulotlarni tekshirish va filtrlash
//     let totalSalesData = (sales || [])
//       .flatMap((sale) =>
//         Array.isArray(sale.deliveredItems) ? sale.deliveredItems : []
//       )
//       .filter(
//         (i) => startOfDay <= i.deliveryDate && i.deliveryDate <= endOfDay
//       );

//     // Boshqaruvchi bo‘limlarni olish
//     const managerialUnits = [
//       "polizol ish boshqaruvchi",
//       "rubiroid ish boshqaruvchi",
//       "ruberoid ish boshqaruvchi",
//       "Okisleniya ish boshqaruvchi",
//     ];

//     const bolimBoshliqlari = await Admins.find({
//       unit: { $in: managerialUnits },
//     }).session(session);

//     for (const item of totalSalesData) {
//       let loadAmount = 0;

//       console.log("item", item);

//       // Mahsulot ma’lumotlarini olish
//       const product = await FinishedProduct.findById(item.productId).session(
//         session
//       );
//       if (product) {
//         const priceInfo = await ProductPriceInfo.findOne({
//           category: { $regex: `^${product.category}$`, $options: "i" },
//           name: { $regex: `^${product.productName}$`, $options: "i" },
//         }).session(session);
//         console.log("priceInfo", priceInfo);
//         if (priceInfo) {
//           loadAmount = priceInfo.loadingCost * item.deliveredQuantity;
//         }
//       }

//       // Yetkazilgan guruhlarni normallashtirish
//       const correctedDeliveredGroups = item.deliveredGroups.map((group) =>
//         group
//           .toLowerCase()
//           .replace(/rubiroid|ruberoid/i, "ruberoid")
//           .replace(/polizol/i, "polizol")
//           .replace(/okisleniya/i, "Okisleniya")
//       );

//       // correctedDeliveredGroups asosida regulyar ifodalar massivini yaratish
//       const unitRegexArray = correctedDeliveredGroups
//         .map((i) => (i === "ruberoid" ? "rubiroid" : i))
//         .map(
//           (group) => new RegExp(group, "i") // Faqat so'zni qidirish uchun, to'liq moslik emas
//         );

//       const baseAttendanceQuery = {
//         date: { $gte: startOfDay, $lte: endOfDay },
//         percentage: hour >= 12 ? { $gt: 0.5 } : { $gt: 0 },
//         unit: {
//           $in: unitRegexArray,
//         }, // Faqat correctedDeliveredGroups guruhlari
//       };

//       let totalAttendances = await Attendance.find(baseAttendanceQuery).session(
//         session
//       );

//       console.log("totalAttendances", totalAttendances);

//       // Davomatdagi bo‘lim nomlarini normallashtirish
//       totalAttendances = totalAttendances.map((item) => ({
//         ...item.toObject(),
//         unit: item.unit
//           .toLowerCase()
//           .replace(/rubiroid|ruberoid/i, "ruberoid")
//           .replace(/polizol/i, "polizol")
//           .replace(/okisleniya/i, "Okisleniya"),
//       }));

//       // Ishchilarning maosh qismlarini hisoblash
//       let workersData = totalAttendances.map((item) => {
//         let isManager = bolimBoshliqlari.some(
//           (bolim) => bolim._id.toString() === item.employee.toString()
//         );
//         return {
//           ...item,
//           salaryPart: isManager ? 1.2 : 1,
//         };
//       });

//       console.log("workersData", workersData);

//       // Umumiy foizni va ishchi boshiga maoshni hisoblash
//       let totalPercentage = workersData.reduce(
//         (sum, worker) => sum + worker.salaryPart,
//         0
//       );
//       const salaryPerWorker =
//         totalPercentage > 0 ? loadAmount / totalPercentage : 0;
//       console.log("correctedDeliveredGroups", correctedDeliveredGroups);

//       for (const dept of correctedDeliveredGroups) {
//         let salaryRecord = await SalaryRecord.findOne({
//           date: { $gte: startOfDay, $lte: endOfDay },
//           department: dept.toLowerCase().includes("okisleniya")
//             ? "Okisleniya"
//             : dept,
//         }).session(session);

//         const attendances = workersData.filter((att) =>
//           att.unit.toLowerCase().includes(dept.toLowerCase())
//         );
//         console.log("attendances", attendances);

//         if (!salaryRecord) {
//           if (attendances.length === 0) {
//             continue;
//           }
//           const workers = attendances.map((att) => ({
//             employee: att.employee,
//             percentage: att.percentage,
//             amount: 0, // Ishlab chiqarish pullari (standart 0)
//             amountOfLoaded: salaryPerWorker * att.salaryPart, // Yuklama pullari
//           }));

//           salaryRecord = new SalaryRecord({
//             date: startOfDay,
//             department: dept.toLowerCase().includes("okisleniya")
//               ? "Okisleniya"
//               : dept,
//             producedCount: 0,
//             loadedCount:
//               item.productName?.toLowerCase().includes("polizol") ||
//               item.productName?.toLowerCase().includes("ruberoid")
//                 ? item.deliveredQuantity
//                 : 0,
//             totalSum: loadAmount,
//             loadedCountKg:
//               !item.productName?.toLowerCase().includes("polizol") ||
//               !item.productName?.toLowerCase().includes("ruberoid")
//                 ? item.deliveredQuantity
//                 : 0,
//             salaryPerPercent: salaryPerWorker,
//             workers,
//             processedItems: [item._id],
//           });
//         } else {
//           // // Ishchilar ro‘yxatini qayta qurish
//           // const newWorkers = attendances.map((att) => {
//           //   const existingWorker = salaryRecord.workers.find(
//           //     (w) => w.employee.toString() === att.employee.toString()
//           //   );
//           //   const newAmount = salaryPerWorker * att.salaryPart;

//           //   return {
//           //     employee: att.employee,
//           //     percentage: att.percentage,
//           //     amount: existingWorker ? existingWorker.amount || 0 : 0, // Ishlab chiqarish pullarini saqlash
//           //     amountOfLoaded: newAmount, // Yuklama pullarini qayta hisoblash
//           //   };
//           // });

//           const newWorkers = attendances.map((att) => {
//             const existingWorker = salaryRecord.workers.find(
//               (w) => w.employee.toString() === att.employee.toString()
//             );

//             const newAmountOfLoaded = salaryPerWorker * att.salaryPart;

//             if (existingWorker) {
//               // Mavjud ishchini yangilash
//               existingWorker.amountOfLoaded =
//                 (existingWorker.amountOfLoaded || 0) + newAmountOfLoaded;
//               return existingWorker;
//             } else {
//               // Yangi ishchini qo'shish
//               return {
//                 employee: att.employee,
//                 percentage: att.percentage,
//                 amount: 0, // Ishlab chiqarish pullarini saqlash
//                 amountOfLoaded: newAmountOfLoaded, // Yuklama pullari
//               };
//             }
//           });

//           // Faqat joriy davomatdagi ishchilarni saqlash
//           // salaryRecord.workers = newWorkers;
//           // salaryRecord.totalSum = (salaryRecord.totalSum || 0) + loadAmount;
//           // salaryRecord.salaryPerPercent = salaryPerWorker;
//           // salaryRecord.processedItems = salaryRecord.processedItems
//           //   ? [...new Set([item._id, ...(salaryRecord.processedItems || [])])]
//           //   : [item._id];
//           // Faqat yangi ishchilarni qo'shish
//           const updatedWorkers = [
//             ...salaryRecord.workers.filter((w) =>
//               attendances.some(
//                 (att) => att.employee.toString() === w.employee.toString()
//               )
//             ),
//             ...newWorkers,
//           ];

//           // Yangilangan ishchilarni saqlash
//           salaryRecord.workers = updatedWorkers;
//           salaryRecord.totalSum = (salaryRecord.totalSum || 0) + loadAmount;
//           salaryRecord.salaryPerPercent = salaryPerWorker;
//           salaryRecord.processedItems = salaryRecord.processedItems
//             ? [...new Set([item._id, ...(salaryRecord.processedItems || [])])]
//             : [item._id];

//           await salaryRecord.save({ session });
//         }

//         // await salaryRecord.save({ session });
//       }

//       console.log("--------------------------------");
//     }

//     if (isNewSession) await session.commitTransaction();
//   } catch (error) {
//     if (isNewSession) await session.abortTransaction();
//     throw error;
//   } finally {
//     if (isNewSession) session.endSession();
//   }
// }

// calculateLoadedPrices();
// module.exports = calculateLoadedPrices;
// ==========================================================================
// const Attendance = require("../../model/attendanceModal");
// const SalaryRecord = require("../../model/salaryRecord");
// const Salecart = require("../../model/saleCartSchema");
// const { Product: ProductPriceInfo } = require("../../model/factoryModel");
// const FinishedProduct = require("../../model/finishedProductModel");
// const Admins = require("../../model/adminModel");
// const mongoose = require("mongoose");

// async function calculateLoadedPrices(
//   date,
//   externalSession,
//   updateAttendance = true
// ) {
//   const session = externalSession || (await mongoose.startSession());
//   const isNewSession = !externalSession;

//   if (isNewSession) session.startTransaction();

//   try {
//     // Sana o'rnatish
//     const baseDate =
//     date && !isNaN(new Date(date).getTime()) ? new Date(date) : new Date();
//     baseDate.setHours(0, 0, 0, 0);
//     const startOfDay = baseDate;
//     const endOfDay = new Date(startOfDay);
//     endOfDay.setHours(23, 59, 59, 999);

//     // Boshqaruvchi bo'limlarni olish
//     const managerialUnits = [
//       "polizol ish boshqaruvchi",
//       "rubiroid ish boshqaruvchi",
//       "ruberoid ish boshqaruvchi",
//       "Okisleniya ish boshqaruvchi",
//     ];

//     const bolimBoshliqlari = await Admins.find({
//       unit: { $in: managerialUnits },
//     }).session(session);

//     // Davomat ma'lumotlarini olish
//     const baseAttendanceQuery = {
//       date: { $gte: startOfDay, $lte: endOfDay },
//       percentage: startOfDay.getHours() >= 12 ? { $gt: 0.5 } : { $gt: 0 },
//     };

//     let totalAttendances = await Attendance.find(baseAttendanceQuery).session(
//       session
//     );

//     // Davomatdagi bo'lim nomlarini normallashtirish
//     totalAttendances = totalAttendances.map((item) => ({
//       ...item.toObject(),
//       unit: item.unit
//       .toLowerCase()
//       .replace(/rubiroid|ruberoid/i, "ruberoid")
//         .replace(/polizol/i, "polizol")
//         .replace(/okisleniya/i, "Okisleniya"),
//       }));

//       // Ishchilarning maosh qismlarini hisoblash
//     const workersData = totalAttendances.map((item) => {
//       const isManager = bolimBoshliqlari.some(
//         (bolim) => bolim._id.toString() === item.employee.toString()
//       );
//       return {
//         ...item,
//         salaryPart: isManager ? 1.2 : 1,
//       };
//     });

//     // Agar davomat yangilansa, faqat yuklama pulini qayta hisoblash
//     if (updateAttendance) {
//       const departments = [...new Set(totalAttendances.map((att) => att.unit))];

//       for (const dept of departments) {
//         const attendances = workersData.filter((att) =>
//           att.unit.toLowerCase().includes(dept.toLowerCase())
//       );

//         if (attendances.length === 0) continue;

//         // Umumiy foizni hisoblash
//         const deptPercentage = attendances.reduce(
//           (sum, worker) => sum + worker.salaryPart,
//           0
//         );

//         // Yuklama ma'lumotlarini olish
//         const sales = await Salecart.Salecart.find({
//           "deliveredItems.deliveryDate": { $gte: startOfDay, $lte: endOfDay },
//         })
//         .select("deliveredItems")
//           .lean()
//           .session(session);

//         const totalSalesData = (sales || [])
//         .flatMap((sale) =>
//           Array.isArray(sale.deliveredItems) ? sale.deliveredItems : []
//       )
//       .filter(
//             (i) => startOfDay <= i.deliveryDate && i.deliveryDate <= endOfDay
//           );

//         let deptLoadAmount = 0;
//         let loadedCount = 0;
//         const processedItems = [];

//         // Umumiy pulni hisoblash
//         for (const item of totalSalesData) {
//           const correctedDeliveredGroups = [
//             ...new Set(
//               item.deliveredGroups.map((group) =>
//                 group
//                   .toLowerCase()
//                   .replace(/rubiroid|ruberoid/i, "ruberoid")
//                   .replace(/polizol/i, "polizol")
//                   .replace(/okisleniya/i, "Okisleniya")
//               )
//             ),
//           ];

//           if (!correctedDeliveredGroups.includes(dept.toLowerCase())) continue;

//           let loadAmount = 0;
//           const product = await FinishedProduct.findById(
//             item.productId
//           ).session(session);
//           if (product) {
//             const priceInfo = await ProductPriceInfo.findOne({
//               category: { $regex: `^${product.category}$`, $options: "i" },
//               name: { $regex: `^${product.productName}$`, $options: "i" },
//             }).session(session);
//             if (priceInfo) {
//               loadAmount = priceInfo.loadingCost * item.deliveredQuantity;
//             }
//           }

//           // Bo'lim uchun umumiy pulni hisoblash
//           const totalPercentage = workersData.reduce(
//             (sum, worker) => sum + worker.salaryPart,
//             0
//           );
//           deptLoadAmount += (loadAmount * deptPercentage) / totalPercentage;
//           loadedCount += item.deliveredQuantity;
//           processedItems.push(item._id);
//         }

//         // Har bir ishchi uchun maoshni hisoblash
//         const salaryPerWorker =
//           deptPercentage > 0 ? deptLoadAmount / deptPercentage : 0;

//           // SalaryRecord ni topish yoki yangisini yaratish
//           let salaryRecord = await SalaryRecord.findOne({
//             date: { $gte: startOfDay, $lte: endOfDay },
//             department: dept,
//           }).session(session);

//           if (!salaryRecord) {
//           salaryRecord = new SalaryRecord({
//             date: startOfDay,
//             department: dept,
//             producedCount: 0,
//             loadedCount: 0,
//             totalSum: 0,
//             salaryPerPercent: 0,
//             workers: [],
//             processedItems: [],
//           });
//         }

//         // Eski ishchilar ro'yxatini saqlash (ishlab chiqarish pulini yo'qotmaslik uchun)
//         const existingWorkers = [...salaryRecord.workers];

//         // Yangi ishchilar ro'yxatini tayyorlash
//         const newWorkers = attendances.map((att) => {
//           const existingWorker = existingWorkers.find(
//             (w) => w.employee.toString() === att.employee.toString()
//           );
//           return {
//             employee: att.employee,
//             percentage: att.percentage,
//             amount: existingWorker ? existingWorker.amount : 0, // Ishlab chiqarish pulini saqlaymiz
//             amountOfLoaded: salaryPerWorker * att.salaryPart, // Yuklama pulini yangilaymiz
//           };
//         });

//         // SalaryRecord ni yangilash
//         salaryRecord.workers = newWorkers;
//         salaryRecord.loadedCount = loadedCount;
//         salaryRecord.totalSum = deptLoadAmount;
//         salaryRecord.salaryPerPercent = salaryPerWorker;
//         salaryRecord.processedItems = processedItems;

//         await salaryRecord.save({ session });
//       }

//       console.log("Davomat yangilandi, yuklama puli qayta hisoblandi");
//       if (isNewSession) await session.commitTransaction();
//       return;
//     }

//     // Oddiy holat: Yuklama hisoblash
//     const sales = await Salecart.Salecart.find({
//       "deliveredItems.deliveryDate": { $gte: startOfDay, $lte: endOfDay },
//     })
//     .select("deliveredItems")
//     .lean()
//     .session(session);

//     const totalSalesData = (sales || [])
//     .flatMap((sale) =>
//       Array.isArray(sale.deliveredItems) ? sale.deliveredItems : []
//   )
//   .filter(
//     (i) => startOfDay <= i.deliveryDate && i.deliveryDate <= endOfDay
//   );

//     for (const item of totalSalesData) {
//       let loadAmount = 0;
//       console.log(
//         "item",
//         item.productName,
//         item.deliveredGroups,
//         item.deliveredQuantity
//       );

//       const product = await FinishedProduct.findById(item.productId).session(
//         session
//       );
//       if (product) {
//         const priceInfo = await ProductPriceInfo.findOne({
//           category: { $regex: `^${product.category}$`, $options: "i" },
//           name: { $regex: `^${product.productName}$`, $options: "i" },
//         }).session(session);
//         if (priceInfo) {
//           loadAmount = priceInfo.loadingCost * item.deliveredQuantity;
//         }
//       }

//       const correctedDeliveredGroups = [
//         ...new Set(
//           item.deliveredGroups.map((group) =>
//             group
//           .toLowerCase()
//               .replace(/rubiroid|ruberoid/i, "ruberoid")
//               .replace(/polizol/i, "polizol")
//               .replace(/okisleniya/i, "Okisleniya")
//             )
//           ),
//         ];

//         const unitRegexArray = correctedDeliveredGroups
//         .map((i) => (i === "ruberoid" ? "rubiroid" : i))
//         .map((group) => new RegExp(group, "i"));

//         const filteredAttendances = workersData.filter((att) =>
//         unitRegexArray.some((regex) => regex.test(att.unit))
//       );

//       const totalPercentage = filteredAttendances.reduce(
//         (sum, worker) => sum + worker.salaryPart,
//         0
//       );

//       for (const dept of correctedDeliveredGroups) {
//         const attendances = filteredAttendances.filter((att) =>
//           att.unit.toLowerCase().includes(dept.toLowerCase())
//         );

//         if (attendances.length === 0) continue;

//         const deptPercentage = attendances.reduce(
//           (sum, worker) => sum + worker.salaryPart,
//           0
//         );

//         const deptLoadAmount = (loadAmount * deptPercentage) / totalPercentage;
//         const salaryPerWorker =
//         deptPercentage > 0 ? deptLoadAmount / deptPercentage : 0;

//         let salaryRecord = await SalaryRecord.findOne({
//           date: { $gte: startOfDay, $lte: endOfDay },
//           department: dept,
//         }).session(session);

//         if (!salaryRecord) {
//           const workers = attendances.map((att) => ({
//             employee: att.employee,
//             percentage: att.percentage,
//             amount: 0,
//             amountOfLoaded: salaryPerWorker * att.salaryPart,
//           }));

//           console.log("workers", workers);

//           salaryRecord = new SalaryRecord({
//             date: startOfDay,
//             department: dept,
//             producedCount: 0,
//             loadedCount: item.deliveredQuantity,
//             totalSum: deptLoadAmount,
//             salaryPerPercent: salaryPerWorker,
//             workers,
//             processedItems: [item._id],
//           });
//         } else {
//           if (salaryRecord.processedItems.includes(item._id.toString())) {
//             continue;
//           }

//           const newWorkers = [...salaryRecord.workers];

//           for (const att of attendances) {
//             const existingWorkerIndex = newWorkers.findIndex(
//               (w) => w.employee.toString() === att.employee.toString()
//             );

//             const newAmountOfLoaded = salaryPerWorker * att.salaryPart;

//             if (existingWorkerIndex !== -1) {
//               newWorkers[existingWorkerIndex].amountOfLoaded =
//                 (newWorkers[existingWorkerIndex].amountOfLoaded || 0) +
//                 newAmountOfLoaded;
//                 newWorkers[existingWorkerIndex].percentage = att.percentage;
//               } else {
//               newWorkers.push({
//                 employee: att.employee,
//                 percentage: att.percentage,
//                 amount: 0,
//                 amountOfLoaded: newAmountOfLoaded,
//               });
//             }
//           }

//           salaryRecord.workers = newWorkers;
//           salaryRecord.loadedCount =
//           (salaryRecord.loadedCount || 0) + item.deliveredQuantity;
//           salaryRecord.totalSum = (salaryRecord.totalSum || 0) + deptLoadAmount;
//           salaryRecord.salaryPerPercent = salaryPerWorker;
//           salaryRecord.processedItems.push(item._id);
//         }

//         await salaryRecord.save({ session });
//       }
//     }
//     console.log("--------------------------------");
//     if (isNewSession) await session.commitTransaction();
//   } catch (error) {
//     if (isNewSession) await session.abortTransaction();
//     throw error;
//   } finally {
//     if (isNewSession) session.endSession();
//   }
// }
// // calculateLoadedPrices();
// module.exports = calculateLoadedPrices;

// ==========================================================================
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
            department: dept,
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
