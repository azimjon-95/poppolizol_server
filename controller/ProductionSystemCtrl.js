const Material = require("../model/wherehouseModel");
const { Product, Factory, AdditionExpen } = require("../model/factoryModel");
const ProductNorma = require("../model/productNormaSchema");
const FinishedProduct = require("../model/finishedProductModel");
const Admins = require("../model/adminModel");
const moment = require('moment');
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
        utilities,
      } = req.body;

      // ✅ Sana formatini to‘g‘rilash (dd.mm.yyyy → yyyy-mm-dd)
      let parsedDate;
      if (date) {
        const [day, month, year] = date.split(".");
        // Local vaqtga mos qilib yaratamiz
        const localDate = new Date(Number(year), Number(month) - 1, Number(day));
        // UTC vaqtga 5 soatni (O'zbekiston uchun) qo'shamiz
        parsedDate = new Date(localDate.getTime() + 5 * 60 * 60 * 1000);
      } else {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        parsedDate = new Date(now.getTime() + 5 * 60 * 60 * 1000);
      }

      if (products.length === 0) {
        return response.error(res, "Hech qanday mahsulot ko‘rsatilmagan");
      }

      const totalQuantity = products.reduce(
        (sum, p) => sum + Number(p.quantity),
        0
      );

      if (totalQuantity <= 0) {
        return response.error(res, "Umumiy miqdor noto‘g‘ri");
      }

      // ✅ Bugungi kun (parsedDate asosida)
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
            "exnik xizmat",
            "Eksport xarajatlari",
            "Yer solig‘i",
            "IT xizmatlar (dasturiy ta’minot)",
            "Qarz to'lovi",
            "Avans",
            "Kadrlar o‘qitish / trening",
            "Komandirovka xarajatlari",
            "Suv / kanalizatsiya tizimi xizmatlari",
            "Chiqindilar utilizatsiyasi",
            "Litsenziya va ruxsatnomalar",
            "Texnik xizmat",
            "Reklama xarajatlari",
            "Transport",
            "Ishlab chiqarish vositalari xaridi",
            "Ofis mebellari va texnikasi",
            "Moliyaviy xizmatlar (bank, auditor)",
            "Bank xizmatlari",
            "Sud va yuridik xarajatlar",
            "USTA va Qurilish ishlari",
            "Ish/chik.xarajatlari",
            "Boshqa xarajatlar (Prochi)",
            "Buxgalteriya xizmati",
            "Soliqlar va majburiy to‘lov",
            "Avto Qora xarajati",
            "Oylik maosh",
          ],
        },
        createdAt: { $gte: today, $lt: tomorrow },
      }).session(session);

      // 2️⃣ Ishlab chiqarish xodimlarini chiqarib tashlash
      const filteredExpenses = [];
      for (const exp of expenses) {
        if (
          ["Avans", "Oylik maosh", "Ish haqi xarajatlari"].includes(exp.category)
        ) {
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

      const totalAmount = filteredExpenses.reduce(
        (sum, item) => sum + item.amount,
        0
      );

      const additionalAmount = totalAmount || 0;

      // ✅ Zavod ma'lumotlarini olish
      const [factory] = await Factory.find().session(session);
      if (!factory) {
        return response.notFound(res, "Zavod ma'lumotlari topilmadi!");
      }

      // ✅ Resurs xarajatlari
      const electricityCostPerKWH = Number(factory.electricityPrice);
      const gasCostPerKWH = Number(factory.methaneGasPrice);
      const totalElectricityUsed = parseFloat(
        (utilities.electricityConsumption || 0).toFixed(2)
      );
      const totalGasUsed = parseFloat((utilities.gasConsumption || 0).toFixed(2));
      const totalElectricityCost = totalElectricityUsed * electricityCostPerKWH;
      const totalGasCost = totalGasUsed * gasCostPerKWH;

      const periodExpense = parseFloat((utilities.periodExpense || 0).toFixed(2));

      // ✅ Materiallar sarfi
      const materialsUsed = [];
      let totalMaterialCost = 0;

      for (const consumed of consumedMaterials) {
        const material = await Material.findById(consumed.materialId).session(
          session
        );
        if (!material) {
          return response.notFound(
            res,
            `Material topilmadi: ID ${consumed.materialId}`
          );
        }

        const consumedQuantity = parseFloat(Number(consumed.quantity || 0).toFixed(2));
        const unitPrice = parseFloat(Number(material.price).toFixed(2));
        const cost = consumedQuantity * unitPrice;
        totalMaterialCost += cost;

        if (Number(material.quantity) < consumedQuantity) {
          return response.error(
            res,
            `Yetarli ${material.name} yo‘q. Kerak: ${consumedQuantity}, Mavjud: ${material.quantity}`
          );
        }

        material.quantity = parseFloat(
          (Number(material.quantity) - consumedQuantity).toFixed(2)
        );
        await material.save({ session });

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
        const quantity = Number(product.quantity);

        if (!normaId || !quantity || quantity <= 0) {
          return response.error(
            res,
            `Mahsulot normasi yoki miqdori noto‘g‘ri: ${productName}`
          );
        }

        const productNorma = await ProductNorma.findById(normaId)
          .lean()
          .session(session);
        if (!productNorma) {
          return response.notFound(res, `Norma topilmadi: ${productName}`);
        }

        const productionPrice = await Product.findOne({
          name: productName,
        }).session(session);
        if (!productionPrice) {
          return response.notFound(res, `Narx topilmadi: ${productName}`);
        }

        const workerPayPerUnit = parseFloat(
          Number(productionPrice.productionCost).toFixed(2)
        );
        const loadingPayPerUnit = parseFloat(
          Number(productionPrice.loadingCost).toFixed(2)
        );

        const productWorkerCost = workerPayPerUnit * quantity;
        const productLoadingCost = loadingPayPerUnit * quantity;

        totalWorkerCost += productWorkerCost;
        totalLoadingCost += productLoadingCost;

        productDataList.push({
          productNorma,
          productionPrice,
          quantity,
          productName,
          category: product.category,
          workerPayPerUnit,
          loadingPayPerUnit,
          productWorkerCost,
          productLoadingCost,
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

      const sharedPerUnit =
        totalQuantity > 0 ? totalSharedCost / totalQuantity : 0;

      const totalCostSum = parseFloat(
        (totalSharedCost + totalWorkerCost + totalLoadingCost).toFixed(2)
      );

      const producedMessages = [];

      for (const prodData of productDataList) {
        const productionCost = parseFloat(
          (
            prodData.workerPayPerUnit +
            prodData.loadingPayPerUnit +
            sharedPerUnit
          ).toFixed(2)
        );

        let finishedProduct = await FinishedProduct.findOne({
          productName: prodData.productNorma.productName,
        }).session(session);

        if (finishedProduct) {
          finishedProduct.quantity += prodData.quantity;
          finishedProduct.productionCost = Math.max(
            finishedProduct.productionCost,
            productionCost
          );
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

        producedMessages.push(
          `${prodData.productNorma.productName} dan ${prodData.quantity} ta ishlab chiqarildi`
        );
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

      // ✅ Maosh hisoblash (shu sanaga asoslangan)
      const startOfDay = new Date(parsedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(parsedDate);
      endOfDay.setHours(23, 59, 59, 999);

      for (const prodData of productDataList) {
        const lowerName = prodData.productName.toLowerCase();

        if (lowerName.includes("ruberoid")) {
          let record = await SalaryRecord.findOne({
            date: { $gte: startOfDay, $lte: endOfDay },
            department: "ruberoid",
          }).session(session);

          if (!record) {
            await SalaryRecord.create(
              [
                {
                  date: parsedDate,
                  department: "ruberoid",
                  producedCount: prodData.quantity,
                },
              ],
              { session }
            );
          } else {
            record.producedCount += prodData.quantity;
            await record.save({ session });
          }
          await reCalculateGlobalSalaries("ruberoid", parsedDate, session);
        }

        if (
          lowerName.includes("polizol") ||
          lowerName.includes("folygoizol")
        ) {
          let record = await SalaryRecord.findOne({
            date: { $gte: startOfDay, $lte: endOfDay },
            department: "polizol",
          }).session(session);

          if (!record) {
            await SalaryRecord.create(
              [
                {
                  date: parsedDate,
                  department: "polizol",
                  producedCount: prodData.quantity,
                },
              ],
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
      return response.created(
        res,
        `✅ Ishlab chiqarildi: ${producedMessages.join(", ")}`,
        {
          totalCost: totalCostSum,
          totalElectricityUsed,
          totalGasUsed,
          totalElectricityCost,
          totalGasCost,
          periodExpense,
        }
      );
    } catch (error) {
      await session.abortTransaction();
      return response.serverError(
        res,
        "❌ Ishlab chiqarish xatolikka uchradi",
        error.message
      );
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
      const material = await Material.findOne({ category: "BN-5" }).lean();

      const bn = {
        _id: material._id,
        productName: "Bitum (5/M) melsiz",
        category: material.category,
        quantity: material.quantity,
        sellingPrice: material.price,
        isReturned: false,
        isDefective: false,
        returnInfo: [],
      };

      let newData = [...products, bn];

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

  // 4454
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
      if (!processData || !packagingData || !Array.isArray(packagingData)) {
        return response.error(res, "Noto'g'ri kirish ma'lumotlari");
      }

      // Materiallarni topish
      const bn5Material = await Material.findOne({ category: "BN-5" }).session(
        session
      );
      const melMaterial = await Material.findOne({ category: "Mel" }).session(
        session
      );
      const ipMaterial = await Material.findOne({ category: "ip" }).session(
        session
      );
      const qopQogoz = await Material.findOne({ category: "qop" }).session(
        session
      );
      const kraf = await Material.findOne({ category: "kraf" }).session(
        session
      );

      if (!bn5Material || !melMaterial || !ipMaterial || !qopQogoz || !kraf) {
        return response.error(res, "Kerakli materiallar topilmadi");
      }
      // Arqon (gramm -> kg)
      const totalRopeKg = packagingData.reduce((sum, pkg) => {
        const ropeGrams = parseFloat(pkg.rope) || 0;
        return sum + ropeGrams / 1000;
      }, 0);

      // Stakan va Qop bo'yicha ajratish
      const stakanItems = packagingData.filter((pkg) =>
        pkg.label.includes("Stakan")
      );
      const qopItems = packagingData.filter((pkg) => pkg.label === "Qop");

      const totalStakanQuantity = stakanItems.reduce(
        (sum, pkg) => sum + (parseFloat(pkg.quantity) || 0),
        0
      );
      const totalQopQuantity = qopItems.reduce(
        (sum, pkg) => sum + (parseFloat(pkg.quantity) || 0),
        0
      );

      // Material yetarliligini tekshirish
      if (
        bn5Material.quantity < bn5Amount ||
        melMaterial.quantity < melAmount ||
        ipMaterial.quantity < totalRopeKg ||
        kraf.quantity < totalStakanQuantity ||
        qopQogoz.quantity < totalQopQuantity
      ) {
        return response.error(res, "Materiallar miqdori yetarli emas");
      }

      // Material miqdorlarini kamaytirish
      bn5Material.quantity -= bn5Amount;
      melMaterial.quantity -= melAmount;
      ipMaterial.quantity -= totalRopeKg;
      kraf.quantity -= totalStakanQuantity;
      qopQogoz.quantity -= totalQopQuantity;

      const [bn5Saved, melSaved, ipSaved, krafSaved, qopSaved] =
        await Promise.all([
          bn5Material.save({ session }),
          melMaterial.save({ session }),
          ipMaterial.save({ session }),
          kraf.save({ session }),
          qopQogoz.save({ session }),
        ]);

      if (!bn5Saved || !melSaved || !ipSaved || !krafSaved || !qopSaved) {
        return response.error(
          res,
          "Materiallar miqdorini yangilashda xatolik yuz berdi"
        );
      }

      // Tayyor mahsulotlarni saqlash
      const finishedProducts = [];

      for (const pkg of packagingData) {
        const { label, bn5Amount: pkgBn5Amount, quantity, unit, rope } = pkg;

        if (!label || !pkgBn5Amount || !quantity || !unit) {
          return response.error(
            res,
            `Noto'g'ri qadoqlash ma'lumotlari: ${JSON.stringify(pkg)}`
          );
        }

        let finishedProduct = await FinishedProduct.findOne({
          productName: label,
          marketType: "tashqi",
        }).session(session);

        if (finishedProduct) {
          finishedProduct.quantity += pkgBn5Amount;
          await finishedProduct.save({ session });
        } else {
          const [newProduct] = await FinishedProduct.create(
            [
              {
                productName: label,
                category: label.includes("Stakan") ? "Stakan" : "Qop",
                quantity: pkgBn5Amount,
                marketType: "tashqi",
                sellingPrice,
                size: unit,
                productionCost: price,
                productionDate: new Date(date),
              },
            ],
            { session }
          );
          finishedProduct = newProduct;
        }

        finishedProducts.push(finishedProduct);
      }

      // Inventory ma'lumotlarini tayyorlash
      const inventoryData = {
        productionName: "BN-5 + Mel",
        date: new Date(date),
        bn5Amount,
        melAmount,
        electricity,
        gasAmount,
        notes,
        extra,
        kraftPaper,
        sellingPrice,
        qop,
        price,
        items: packagingData.map((pkg) => ({
          label: pkg.label,
          bn5Amount: pkg.bn5Amount,
          quantity: pkg.quantity,
          unit: pkg.unit,
          rope: pkg.rope,
        })),
      };

      // Inventory'ga saqlash
      const [inventory] = await Inventory.create([inventoryData], { session });

      let btm5Sale = bn5Amount + melAmount;
      // await CalculateBN5forSale(btm5Sale, date, session);

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
              btm_5_sale: btm5Sale,
            },
          ],
          { session }
        );
        exactSalaryRecord = exactSalaryRecord[0];
      } else {
        exactSalaryRecord.btm_5_sale += btm5Sale;
        await exactSalaryRecord.save({ session });
      }

      // Recalculate salaries
      await reCalculateGlobalSalaries("Okisleniya", startOfDay, session);

      // Yakunlash
      await session.commitTransaction();

      return response.created(
        res,
        `${packagingData.reduce(
          (sum, pkg) => sum + pkg.quantity,
          0
        )} dona tashqi bozor uchun muvaffaqiyatli ishlab chiqarildi`,
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

  //Inventory get
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
        topProducts,
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
