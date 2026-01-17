const Material = require("../model/wherehouseModel");
const { Product, Factory, AdditionExpen } = require("../model/factoryModel");
const ProductNorma = require("../model/productNormaSchema");
const FinishedProduct = require("../model/finishedProductModel");
const Admins = require("../model/adminModel");
const moment = require("moment");
const { Salecart, Customer } = require("../model/saleCartSchema");
const Expense = require("../model/expenseModel");
const ProductionHistory = require("../model/ProductionHistoryModel");
const Inventory = require("../model/inventoryHistoryModel");
const response = require("../utils/response");
const mongoose = require("mongoose");

const reCalculateGlobalSalaries = require("./calculateSalary/globalCalculate");

const SalaryRecord = require("../model/salaryRecord");

class ProductionSystem {

  async productionProcess(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        date = "",
        products = [],
        consumedMaterials = [],
        utilities = {}, // ✅ default
      } = req.body;

      // ✅ Sana formatini to‘g‘rilash (dd.mm.yyyy → yyyy-mm-dd)
      let parsedDate;
      if (date) {
        const [day, month, year] = String(date).split(".");
        const localDate = new Date(Number(year), Number(month) - 1, Number(day));
        parsedDate = new Date(localDate.getTime() + 5 * 60 * 60 * 1000);
      } else {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        parsedDate = new Date(now.getTime() + 5 * 60 * 60 * 1000);
      }

      if (!Array.isArray(products) || products.length === 0) {
        return response.error(res, "Hech qanday mahsulot ko‘rsatilmagan");
      }

      const totalQuantity = products.reduce((sum, p) => sum + Number(p.quantity || 0), 0);
      if (totalQuantity <= 0) {
        return response.error(res, "Umumiy miqdor noto‘g‘ri");
      }

      const today = new Date(parsedDate);
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      // 1️⃣ Shu sanaga tegishli chiqimlarni olish
      const expenses = await Expense.find({
        type: "chiqim",
        category: {
          $in: [
            "Oziq ovqat xarajatlari",
            "Transport xarajatlari",
            "Ofis xarajatlari",
            "Uskuna ta’miri",
            "Internet va aloqa",
            "texnik xizmat",
            "Eksport xarajatlari",
            "IT xizmatlar (dasturiy ta’minot)",
            "Qarz to'lovi",
            "Kadrlar o‘qitish / trening",
            "Komandirovka xarajatlari",
            "Chiqindilar utilizatsiyasi",
            "Litsenziya va ruxsatnomalar",
            "Texnik xizmat",
            "Reklama xarajatlari",
            "Ishlab chiqarish vositalari xaridi",
            "Ofis mebellari va texnikasi",
            "Moliyaviy xizmatlar (bank, auditor)",
            "Sud va yuridik xarajatlar",
            "USTA va Qurilish ishlari",
            "Boshqa xarajatlar (Prochi)",
            "Buxgalteriya xizmati",
          ],
        },
        createdAt: { $gte: today, $lt: tomorrow },
      }).session(session);

      // 2️⃣ Ishlab chiqarish xodimlarini chiqarib tashlash
      const filteredExpenses = [];
      for (const exp of expenses) {
        if (["Avans", "Oylik maosh", "Ish haqi xarajatlari"].includes(exp.category)) {
          if (exp.relatedId) {
            const employee = await Admins.findById(exp.relatedId).lean();
            if (!employee || employee.role !== "ishlab chiqarish") {
              filteredExpenses.push(exp);
            }
          } else {
            filteredExpenses.push(exp);
          }
        } else {
          filteredExpenses.push(exp);
        }
      }

      const additionalAmount = filteredExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);

      // ✅ Zavod ma'lumotlarini olish
      const [factory] = await Factory.find().session(session);
      if (!factory) return response.notFound(res, "Zavod ma'lumotlari topilmadi!");

      // ✅ Resurs xarajatlari
      const electricityCostPerKWH = Number(factory.electricityPrice || 0);
      const gasCostPerKWH = Number(factory.methaneGasPrice || 0);

      const totalElectricityUsed = parseFloat(Number(utilities.electricityConsumption || 0).toFixed(2));
      const totalGasUsed = parseFloat(Number(utilities.gasConsumption || 0).toFixed(2));

      const totalElectricityCost = totalElectricityUsed * electricityCostPerKWH;
      const totalGasCost = totalGasUsed * gasCostPerKWH;

      const periodExpense = parseFloat(Number(utilities.periodExpense || 0).toFixed(2));

      // ✅ Materiallar sarfi
      const materialsUsed = [];
      let totalMaterialCost = 0;

      for (const consumed of consumedMaterials || []) {
        const material = await Material.findById(consumed.materialId).session(session);
        if (!material) {
          return response.notFound(res, `Material topilmadi: ID ${consumed.materialId}`);
        }

        const consumedQuantity = parseFloat(Number(consumed.quantity || 0).toFixed(2));
        const unitPrice = parseFloat(Number(material.price || 0).toFixed(2));
        const cost = consumedQuantity * unitPrice;

        if (Number(material.quantity || 0) < consumedQuantity) {
          return response.error(
            res,
            `Yetarli ${material.name} yo‘q. Kerak: ${consumedQuantity}, Mavjud: ${material.quantity}`
          );
        }

        material.quantity = parseFloat((Number(material.quantity) - consumedQuantity).toFixed(2));
        await material.save({ session });

        totalMaterialCost += cost;

        materialsUsed.push({
          materialId: material._id,
          materialName: material.name,
          quantityUsed: consumedQuantity,
          unitPrice,
          totalCost: cost,
        });
      }

      // ✅ Mahsulotlar
      let totalWorkerCost = 0;
      let totalLoadingCost = 0;
      const productDataList = [];
      const productsForHistory = [];

      for (const product of products) {
        const normaId = product.normaId;
        const productName = product.name;
        const quantity = Number(product.quantity || 0);

        if (!normaId || quantity <= 0) {
          return response.error(res, `Mahsulot normasi yoki miqdori noto‘g‘ri: ${productName}`);
        }

        const productNorma = await ProductNorma.findById(normaId).lean().session(session);
        if (!productNorma) return response.notFound(res, `Norma topilmadi: ${productName}`);

        const productionPrice = await Product.findOne({ name: productName }).session(session);
        if (!productionPrice) return response.notFound(res, `Narx topilmadi: ${productName}`);

        const workerPayPerUnit = parseFloat(Number(productionPrice.productionCost || 0).toFixed(2));
        const loadingPayPerUnit = parseFloat(Number(productionPrice.loadingCost || 0).toFixed(2));

        const productWorkerCost = workerPayPerUnit * quantity;
        const productLoadingCost = loadingPayPerUnit * quantity;

        totalWorkerCost += productWorkerCost;
        totalLoadingCost += productLoadingCost;

        productDataList.push({
          productNorma,
          productionPrice,
          quantity,
          productName,
          category: product.category, // ✅ frontdan keladi
          workerPayPerUnit,
          loadingPayPerUnit,
        });

        productsForHistory.push({
          productName: productNorma.productName,
          quantityProduced: quantity,
          salePrice: Number(productNorma.salePrice || 0),
          totalSaleValue: quantity * Number(productNorma.salePrice || 0),
        });
      }

      // ✅ Umumiy hisob-kitoblar
      const totalSharedCost =
        totalMaterialCost +
        totalGasCost +
        totalElectricityCost +
        additionalAmount +
        periodExpense;

      const sharedPerUnit = totalQuantity > 0 ? totalSharedCost / totalQuantity : 0;

      const totalCostSum = parseFloat((totalSharedCost + totalWorkerCost + totalLoadingCost).toFixed(2));

      const producedMessages = [];

      // FinishedProduct update/create
      for (const prodData of productDataList) {
        const productionCost = parseFloat(
          (prodData.workerPayPerUnit + prodData.loadingPayPerUnit + sharedPerUnit).toFixed(2)
        );

        let finishedProduct = await FinishedProduct.findOne({
          productName: prodData.productNorma.productName,
        }).session(session);

        if (finishedProduct) {
          finishedProduct.quantity += prodData.quantity;
          finishedProduct.productionCost = Math.max(finishedProduct.productionCost || 0, productionCost);
          await finishedProduct.save({ session });
        } else {
          await FinishedProduct.create(
            [
              {
                productName: prodData.productNorma.productName,
                category: prodData.productNorma.category || prodData.category,
                quantity: prodData.quantity,
                productionCost,
                sellingPrice: Number(prodData.productNorma.salePrice || 0),
              },
            ],
            { session }
          );
        }

        producedMessages.push(`${prodData.productNorma.productName} dan ${prodData.quantity} ta ishlab chiqarildi`);
      }

      // ✅ Ishlab chiqarish tarixi
      await ProductionHistory.create(
        [
          {
            date: parsedDate,
            products: productsForHistory,
            materialsUsed,
            materialStatistics: { totalMaterialCost },
            gasConsumption: totalGasUsed,
            gasCost: totalGasCost,
            electricityConsumption: totalElectricityUsed,
            electricityCost: totalElectricityCost,
            periodExpense,
            otherExpenses: additionalAmount,
            workerExpenses: totalWorkerCost + totalLoadingCost,
            totalBatchCost: totalCostSum,
          },
        ],
        { session }
      );

      // ✅ Maosh hisoblash
      const startOfDay = new Date(parsedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(parsedDate);
      endOfDay.setHours(23, 59, 59, 999);

      for (const prodData of productDataList) {
        const lowerName = String(prodData.productName || "").toLowerCase();

        if (lowerName.includes("ruberoid")) {
          let record = await SalaryRecord.findOne({
            date: { $gte: startOfDay, $lte: endOfDay },
            department: "ruberoid",
          }).session(session);

          if (!record) {
            await SalaryRecord.create(
              [{ date: parsedDate, department: "ruberoid", producedCount: prodData.quantity }],
              { session }
            );
          } else {
            record.producedCount += prodData.quantity;
            await record.save({ session });
          }
          await reCalculateGlobalSalaries("ruberoid", parsedDate, session);
        }

        if (lowerName.includes("polizol") || lowerName.includes("folygoizol")) {
          let record = await SalaryRecord.findOne({
            date: { $gte: startOfDay, $lte: endOfDay },
            department: "polizol",
          }).session(session);

          if (!record) {
            await SalaryRecord.create(
              [{ date: parsedDate, department: "polizol", producedCount: prodData.quantity }],
              { session }
            );
          } else {
            record.producedCount += prodData.quantity;
            await record.save({ session });
          }
          await reCalculateGlobalSalaries("polizol", parsedDate, session);
        }
      }

      await session.commitTransaction();

      return response.created(res, `✅ Ishlab chiqarildi: ${producedMessages.join(", ")}`, {
        totalCost: totalCostSum,
        totalElectricityUsed,
        totalGasUsed,
        totalElectricityCost,
        totalGasCost,
        periodExpense,
      });
    } catch (error) {
      await session.abortTransaction();
      return response.serverError(res, "❌ Ishlab chiqarish xatolikka uchradi", error.message);
    } finally {
      session.endSession();
    }
  }


  async finishedProducts(req, res) {
    try {
      // 1) deliveredItems bo‘yicha umumiy sotilgan miqdorlarni hisoblash
      const topProducts = await Salecart.aggregate([
        { $unwind: "$deliveredItems" },
        {
          $group: {
            _id: "$deliveredItems.productName",
            totalSold: { $sum: "$deliveredItems.deliveredQuantity" },
          },
        },
        { $sort: { totalSold: -1 } }, // eng ko‘p sotilganidan eng kamigacha
      ]);

      // 2) finishedProduct va materialni olish
      const products = await FinishedProduct.find().lean();
      let newData = [...products];

      // 3) productlarni sotilgan miqdorga qarab tartiblash
      const soldMap = {};
      topProducts.forEach((p) => {
        soldMap[p._id] = p.totalSold;
      });

      newData.sort((a, b) => {
        const soldA = soldMap[a.productName] || 0;
        const soldB = soldMap[b.productName] || 0;

        if (soldA === soldB) return 0;
        return soldB - soldA; // katta miqdor yuqorida
      });

      return response.success(
        res,
        "Finished products retrieved and sorted successfully",
        newData
      );
    } catch (error) {
      return response.serverError(
        res,
        "Failed to retrieve finished products",
        error.message
      );
    }
  }

  async productionHistory(req, res) {
    try {
      const { startDate, endDate } = req.query;

      // Validate query parameters
      if (!startDate || !endDate) {
        return response.badRequest(res, "startDate and endDate are required");
      }

      // Convert query parameters to Date objects
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Validate date formats
      if (isNaN(start) || isNaN(end)) {
        return response.badRequest(
          res,
          "Invalid date format for startDate or endDate"
        );
      }

      // Ensure endDate is not before startDate
      if (end < start) {
        return response.badRequest(res, "endDate cannot be before startDate");
      }
      // Query ProductionHistory with date range filter
      const history = await ProductionHistory.find({
        createdAt: {
          $gte: start,
          $lte: new Date(end.setHours(23, 59, 59, 999)), // Include full end date
        },
      }).sort({ createdAt: -1 });

      return response.success(
        res,
        "Production history retrieved successfully",
        history
      );
    } catch (error) {
      return response.serverError(
        res,
        "Failed to retrieve production history",
        error.message
      );
    }
  }


  async createBn5Production(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    let isCommitted = false;

    try {
      const {
        date,
        bn3Amount,
        wasteAmount,
        gasAmount,
        electricity,
        extra,
        price,
        notes = "",
      } = req.body;

      // Validate required fields
      if (!date || !bn3Amount || !wasteAmount || !price) {
        await session.abortTransaction();
        session.endSession();
        return response.error(
          res,
          "Majburiy maydonlar yetishmayapti: date, bn3Amount, wasteAmount va price kerak"
        );
      }

      const finalBn5 = bn3Amount - wasteAmount;
      const unitCost = Number(price);

      if (isNaN(unitCost) || unitCost <= 0) {
        await session.abortTransaction();
        session.endSession();
        return response.error(res, "Noto‘g‘ri narx kiritildi");
      }

      if (finalBn5 < 0) {
        await session.abortTransaction();
        session.endSession();
        return response.error(
          res,
          "Chiqarilgan BN-5 miqdori manfiy bo‘lishi mumkin emas"
        );
      }

      // BN-3 mavjudligini tekshirish
      const bn3Material = await Material.findOne({ category: "BN-3" }).session(
        session
      );
      if (!bn3Material || bn3Material.quantity < bn3Amount) {
        await session.abortTransaction();
        session.endSession();
        return response.error(
          res,
          `BN-3 yetarli emas. Talab: ${bn3Amount}, Mavjud: ${bn3Material?.quantity || 0
          }`
        );
      }

      // BN-5 materialni yaratish yoki yangilash
      let bn5Material = await Material.findOne({ category: "BN-5" }).session(
        session
      );
      if (bn5Material) {
        const oldQuantity = bn5Material.quantity;
        const oldPrice = Number(bn5Material.price) || 0;
        const totalQuantity = oldQuantity + finalBn5;
        const weightedAveragePrice =
          (oldQuantity * oldPrice + finalBn5 * unitCost) / totalQuantity;

        bn5Material.quantity = totalQuantity;
        bn5Material.price = weightedAveragePrice;
        await bn5Material.save({ session });
      } else {
        const createdBn5 = await Material.create(
          [
            {
              name: "BN-5",
              quantity: finalBn5,
              price: unitCost,
              currency: "sum",
              unit: "kilo",
              category: "BN-5",
            },
          ],
          { session }
        );
        bn5Material = createdBn5[0];
      }

      // BN-3 dan kerakli miqdorni kamaytirish
      bn3Material.quantity -= bn3Amount;
      await bn3Material.save({ session });

      // Inventory ma'lumotlarini tayyorlash
      const inventoryData = {
        productionName: "BN-5",
        date: new Date(date),
        bn5Amount: finalBn5,
        melAmount: 0, // No melAmount in input, set to 0
        electricity: electricity || 0,
        gasAmount: gasAmount || 0,
        notes,
        extra: extra || 0,
        kraftPaper: 0, // Not provided, set to 0
        sellingPrice: 0, // Not provided, set to 0
        qop: 0, // Not provided, set to 0
        price: unitCost,
        items: [], // No packaging data, set to empty array
      };

      // Inventory'ga saqlash
      const [inventory] = await Inventory.create([inventoryData], { session });

      // await calculateOchisleniyaBN3(bn3Amount, finalBn5, date, session);

      // Date range for SalaryRecord

      const startOfDay = new Date(date).setHours(0, 0, 0, 0);
      const endOfDay = new Date(date).setHours(23, 59, 59, 999);

      // Check for existing SalaryRecord
      let exactSalaryRecord = await SalaryRecord.findOne({
        date: { $gte: startOfDay, $lte: endOfDay },
        department: "Okisleniya",
      }).session(session);

      if (!exactSalaryRecord) {
        exactSalaryRecord = await SalaryRecord.create(
          [
            {
              date: new Date(date),
              department: "Okisleniya",
              btm_3: +bn3Amount,
              btm_5: +finalBn5,
            },
          ],
          { session }
        );
        exactSalaryRecord = exactSalaryRecord[0];
      } else {
        exactSalaryRecord.btm_3 += +bn3Amount;
        exactSalaryRecord.btm_5 += +finalBn5;
        await exactSalaryRecord.save({ session });
      }

      // Recalculate salaries
      await reCalculateGlobalSalaries("Okisleniya", startOfDay, session);

      await session.commitTransaction();
      isCommitted = true;

      return response.created(
        res,
        `BN-5 ishlab chiqarish muvaffaqiyatli: ${finalBn5} kg`,
        {
          finalBn5,
          price: unitCost,
          inventoryId: inventory._id,
        }
      );
    } catch (error) {
      if (!isCommitted) {
        await session.abortTransaction();
      }
      return response.serverError(
        res,
        "BN-5 ishlab chiqarishda xatolik",
        error.message
      );
    } finally {
      session.endSession();
    }
  }


  async productionForSalesBN5(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { processData, packagingData } = req.body;

      if (!processData || !packagingData || !Array.isArray(packagingData)) {
        return response.error(res, "Noto'g'ri kirish ma'lumotlari");
      }

      const {
        date,
        bn5Amount,
        melAmount,
        electricity,
        gasAmount,
        sellingPrice,
        extra,
        kraftPaper,
        qop,
        price,
        notes = "",
      } = processData;

      // =========================
      // MATERIALS
      // =========================
      const bn5Material = await Material.findOne({ category: "BN-5" }).session(session);
      const melMaterial = await Material.findOne({ category: "Mel" }).session(session);
      const ipMaterial = await Material.findOne({ category: "ip" }).session(session);
      const qopQogoz = await Material.findOne({ category: "qop" }).session(session);
      const kraf = await Material.findOne({ category: "kraf" }).session(session);

      if (!bn5Material || !melMaterial || !ipMaterial || !qopQogoz || !kraf) {
        return response.error(res, "Kerakli materiallar topilmadi");
      }

      // =========================
      // ROPE (grams -> kg)
      // =========================
      const totalRopeKg = packagingData.reduce((sum, pkg) => {
        const ropeGrams = parseFloat(pkg.rope) || 0;
        return sum + ropeGrams / 1000;
      }, 0);

      // =========================
      // STAKAN / QOP SPLIT
      // =========================
      const stakanItems = packagingData.filter((pkg) => String(pkg.label || "").includes("Stakan"));
      // Sizda frontda label "BN-5 Qop" bo'ladi.
      // Shuning uchun backendda "Qop" deb qattiq tekshirish xato bo'lishi mumkin.
      // Bu yerda qopni label ichida "Qop" bo'lsa deb tekshiramiz:
      const qopItems = packagingData.filter((pkg) => String(pkg.label || "").includes("Qop"));

      const totalStakanQuantity = stakanItems.reduce(
        (sum, pkg) => sum + (parseFloat(pkg.quantity) || 0),
        0
      );
      const totalQopQuantity = qopItems.reduce(
        (sum, pkg) => sum + (parseFloat(pkg.quantity) || 0),
        0
      );

      // =========================
      // STOCK CHECK
      // =========================
      const bn5Need = Number(bn5Amount) || 0;
      const melNeed = Number(melAmount) || 0;

      if (
        bn5Material.quantity < bn5Need ||
        melMaterial.quantity < melNeed ||
        ipMaterial.quantity < totalRopeKg ||
        kraf.quantity < totalStakanQuantity ||
        qopQogoz.quantity < totalQopQuantity
      ) {
        return response.error(res, "Materiallar miqdori yetarli emas");
      }

      // =========================
      // DECREMENT STOCKS
      // =========================
      bn5Material.quantity -= bn5Need;
      melMaterial.quantity -= melNeed;
      ipMaterial.quantity -= totalRopeKg;
      kraf.quantity -= totalStakanQuantity;
      qopQogoz.quantity -= totalQopQuantity;

      const [bn5Saved, melSaved, ipSaved, krafSaved, qopSaved] = await Promise.all([
        bn5Material.save({ session }),
        melMaterial.save({ session }),
        ipMaterial.save({ session }),
        kraf.save({ session }),
        qopQogoz.save({ session }),
      ]);

      if (!bn5Saved || !melSaved || !ipSaved || !krafSaved || !qopSaved) {
        return response.error(res, "Materiallar miqdorini yangilashda xatolik yuz berdi");
      }

      // =========================
      // FINISHED PRODUCTS
      // =========================
      const finishedProducts = [];

      // ✅ YANGI: melAmount = 0 bo'lsa — melsiz productga yozamiz
      const isMelZero = Number(melAmount) === 0;
      const melsizProductName = "BN-5 Melsiz";
      console.log(isMelZero);

      for (const pkg of packagingData) {
        const { label, bn5Amount: pkgBn5Amount, quantity, unit } = pkg;

        if (!label || pkgBn5Amount == null || !quantity || !unit) {
          return response.error(
            res,
            `Noto'g'ri qadoqlash ma'lumotlari: ${JSON.stringify(pkg)}`
          );
        }

        // melAmount=0 bo'lsa hammasi "Bitum (5/M) melsiz" ga yig'iladi
        const targetProductName = isMelZero ? melsizProductName : label;

        const computedCategory = isMelZero
          ? "BN-5"
          : (String(targetProductName).includes("Stakan") ? "Stakan" : "Qop");

        let finishedProduct = await FinishedProduct.findOne({
          productName: targetProductName,
          marketType: "tashqi",
        }).session(session);

        if (finishedProduct) {
          finishedProduct.quantity += Number(pkgBn5Amount) || 0;
          // ✅ update category when mel=0
          finishedProduct.category = computedCategory;
          // ixtiyoriy, lekin yaxshi: so'nggi ishlab chiqarish qiymatlarini yangilab qo'yish
          finishedProduct.sellingPrice = Number(sellingPrice) || finishedProduct.sellingPrice;
          finishedProduct.productionCost = Number(price) || finishedProduct.productionCost;
          finishedProduct.productionDate = new Date(date);
          finishedProduct.size = unit;

          await finishedProduct.save({ session });
        } else {
          const [newProduct] = await FinishedProduct.create(
            [
              {
                productName: targetProductName,
                category: computedCategory,
                quantity: Number(pkgBn5Amount) || 0,
                marketType: "tashqi",
                sellingPrice: Number(sellingPrice) || 0,
                size: unit,
                productionCost: Number(price) || 0,
                productionDate: new Date(date),
              },
            ],
            { session }
          );

          finishedProduct = newProduct;
        }

        finishedProducts.push(finishedProduct);
      }

      // =========================
      // INVENTORY
      // =========================
      const inventoryData = {
        productionName: "BN-5 + Mel",
        date: new Date(date),
        bn5Amount: bn5Need,
        melAmount: melNeed,
        electricity: Number(electricity) || 0,
        gasAmount: Number(gasAmount) || 0,
        notes,
        extra: Number(extra) || 0,
        kraftPaper: Number(kraftPaper) || 0,
        sellingPrice: Number(sellingPrice) || 0,
        qop: Number(qop) || 0,
        price: Number(price) || 0,
        items: packagingData.map((pkg) => ({
          label: pkg.label,
          bn5Amount: pkg.bn5Amount,
          quantity: pkg.quantity,
          unit: pkg.unit,
          rope: pkg.rope,
        })),
      };

      const [inventory] = await Inventory.create([inventoryData], { session });

      // =========================
      // SALARY RECORD
      // =========================
      const btm5Sale = bn5Need + melNeed;

      const startOfDay = new Date(date).setHours(0, 0, 0, 0);
      const endOfDay = new Date(date).setHours(23, 59, 59, 999);

      let exactSalaryRecord = await SalaryRecord.findOne({
        date: { $gte: startOfDay, $lte: endOfDay },
        department: "Okisleniya",
      }).session(session);

      if (!exactSalaryRecord) {
        const created = await SalaryRecord.create(
          [
            {
              date: new Date(date),
              department: "Okisleniya",
              btm_5_sale: btm5Sale,
            },
          ],
          { session }
        );
        exactSalaryRecord = created[0];
      } else {
        exactSalaryRecord.btm_5_sale += btm5Sale;
        await exactSalaryRecord.save({ session });
      }

      await reCalculateGlobalSalaries("Okisleniya", startOfDay, session);

      // =========================
      // COMMIT
      // =========================
      await session.commitTransaction();

      return response.created(
        res,
        `${packagingData.reduce((sum, pkg) => sum + (Number(pkg.quantity) || 0), 0)} dona tashqi bozor uchun muvaffaqiyatli ishlab chiqarildi`,
        {
          totalCost: price,
          inventoryId: inventory._id,
          finishedProducts: finishedProducts.map((fp) => ({
            id: fp._id,
            productName: fp.productName,
            quantity: fp.quantity,
          })),
          totalStakanQuantity,
          totalQopQuantity,
        }
      );
    } catch (error) {
      console.error("Production error:", error);
      await session.abortTransaction();
      return response.error(
        res,
        "Ishlab chiqarish jarayoni muvaffaqiyatsiz yakunlandi",
        error.message
      );
    } finally {
      session.endSession();
    }
  }






  async getInventory(req, res) {
    try {
      const { startDate, endDate } = req.query;

      // Validate query parameters
      if (!startDate || !endDate) {
        return response.badRequest(res, "startDate and endDate are required");
      }

      // Convert query parameters to Date objects
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Validate date formats
      if (isNaN(start) || isNaN(end)) {
        return response.badRequest(
          res,
          "Invalid date format for startDate or endDate"
        );
      }

      // Ensure endDate is not before startDate
      if (end < start) {
        return response.badRequest(res, "endDate cannot be before startDate");
      }

      // Query Inventory with date range filter
      const inventory = await Inventory.find({
        date: {
          $gte: start,
          $lte: new Date(end.setHours(23, 59, 59, 999)), // Include full end date
        },
      });

      if (!inventory || inventory.length === 0) {
        return response.notFound(res, "Inventory not found");
      }

      return response.success(res, "Inventory found", inventory);
    } catch (error) {
      return response.error(res, error.message);
    }
  }

  // Update (PUT /api/finished-products/:id)
  async updateFinished(req, res) {
    try {
      const { id } = req.params;
      const updatedData = req.body;

      const updatedProduct = await FinishedProduct.findByIdAndUpdate(
        id,
        updatedData,
        { new: true, runValidators: true }
      );

      if (!updatedProduct) {
        return response.notFound(res, "Mahsulot topilmadi");
      }

      return response.success(
        res,
        "Mahsulot muvaffaqiyatli yangilandi",
        updatedProduct
      );
    } catch (error) {
      console.error("Update error:", error);
      return response.serverError(
        res,
        "Mahsulotni yangilashda xatolik",
        error.message
      );
    }
  }

  // Delete (DELETE /api/finished-products/:id)
  async deleteFinished(req, res) {
    try {
      const { id } = req.params;

      const deletedProduct = await FinishedProduct.findByIdAndDelete(id);

      if (!deletedProduct) {
        return response.notFound(res, "Mahsulot topilmadi");
      }

      return response.success(
        res,
        "Mahsulot muvaffaqiyatli o'chirildi",
        deletedProduct
      );
    } catch (error) {
      console.error("Delete error:", error);
      return response.serverError(
        res,
        "Mahsulotni o‘chirishda xatolik",
        error.message
      );
    }
  }

  async getTopProductsByMonth(req, res) {
    try {
      let { monthYear } = req.query; // front-enddan "YYYY-MM" keladi
      if (!monthYear) {
        // agar kelmasa default hozirgi oy
        monthYear = moment().format("YYYY-MM");
      }

      // boshlanish va tugash sanalari
      const startDate = moment(monthYear, "YYYY-MM").startOf("month").toDate();
      const endDate = moment(monthYear, "YYYY-MM").endOf("month").toDate();

      const topProducts = await Salecart.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        { $unwind: "$deliveredItems" },
        {
          $group: {
            _id: "$deliveredItems.productName",
            totalSold: { $sum: "$deliveredItems.deliveredQuantity" },
          },
        },
        { $sort: { totalSold: -1 } },
      ]);

      return response.success(
        res,
        "Top mahsulotlar muvaffaqiyatli olindi",
        topProducts
      );
    } catch (error) {
      return response.serverError(
        res,
        "Top mahsulotlarni olishda xatolik",
        error.message
      );
    }
  }
}

module.exports = new ProductionSystem();
