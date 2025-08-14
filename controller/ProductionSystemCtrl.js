const Material = require("../model/wherehouseModel");
const { Product, Factory, AdditionExpen } = require("../model/factoryModel");
const ProductNorma = require("../model/productNormaSchema");
const FinishedProduct = require("../model/finishedProductModel");
const Admins = require("../model/adminModel");
const Expense = require("../model/expenseModel");
const ProductionHistory = require("../model/ProductionHistoryModel");
const Inventory = require("../model/inventoryHistoryModel");
const response = require("../utils/response");
const mongoose = require("mongoose");
const {
  calculateOchisleniya,
  reCalculateBtm5Sale,
} = require("./calculateSalary/calculateOchisleniya");

const {
  calculatePolizolSalaries,
} = require("./calculateSalary/calculatePolizol");

const {
  calculateRuberoidSalaries,
} = require("./calculateSalary/calculateRubiroid");

class ProductionSystem {

  async productionProcess(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        productNormaId,
        productName,
        quantityToProduce,
        consumedMaterials,
        materialStatistics,
        electricityConsumption,
        gasConsumption,
        marketType = "tashqi",
        isDefective = false,
        defectiveReason = "",
        defectiveDescription = "",
        date = new Date(),
      } = req.body;
      // Mahsulot normasi topilmadi yoki xarajatlari aniqlanmagan
      const quantity = Number(quantityToProduce);

      if (!productNormaId || !quantity || quantity <= 0) {
        return response.error(res, "Mahsulot normasi yoki miqdori noto‘g‘ri");
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // 1. Bugungi kun chiqimlarini olish
      let expenses = await Expense.find({
        type: 'chiqim',
        category: {
          $in: [
            'Oziq ovqat xarajatlari',
            'Transport xarajatlari',
            'Ofis xarajatlari',
            'Uskuna ta’miri',
            'Internet va aloqa',
            'exnik xizmat',
            'Eksport xarajatlari',
            'Yer solig‘i',
            'IT xizmatlar (dasturiy ta’minot)',
            "Qarz to'lovi",
            'Avans',
            'Kadrlar o‘qitish / trening',
            'Komandirovka xarajatlari',
            'Suv / kanalizatsiya tizimi xizmatlari',
            'Chiqindilar utilizatsiyasi',
            'Litsenziya va ruxsatnomalar',
            'Texnik xizmat',
            'Reklama xarajatlari',
            'Transport',
            'Ishlab chiqarish vositalari xaridi',
            'Ofis mebellari va texnikasi',
            'Moliyaviy xizmatlar (bank, auditor)',
            'Bank xizmatlari',
            'Sud va yuridik xarajatlar',
            'USTA va Qurilish ishlari',
            'Ish/chik.xarajatlari',
            'Boshqa xarajatlar (Prochi)',
            'Buxgalteriya xizmati',
            'Soliqlar va majburiy to‘lov',
            'Avto Qora xarajati',
            'Oylik maosh'
          ]
        },
        createdAt: { $gte: today, $lt: tomorrow }
      }).session(session);

      // 2. Filtrlash — Avans va Oylik maosh larida ishlab chiqarish xodimlarini chiqarib tashlash
      const filteredExpenses = [];

      for (const exp of expenses) {
        if (['Avans', 'Oylik maosh', 'Ish haqi xarajatlari'].includes(exp.category)) {
          if (exp.relatedId) {
            const employee = await Admins.findById(exp.relatedId).lean();
            if (!employee || employee.role !== 'ishlab chiqarish') {
              filteredExpenses.push(exp);
            }
          } else {
            filteredExpenses.push(exp); // relatedId yo‘q bo‘lsa ham qo‘shamiz
          }
        } else {
          filteredExpenses.push(exp);
        }
      }

      const totalAmount = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);


      const [additionExpen] = await AdditionExpen.find().session(session);
      if (!additionExpen) {
        return response.notFound(res, "Tannarx va boshqa xarajatlari topilmadi!");
      }

      const additional = totalAmount || 0;
      const additionalAmount = (additional * additionExpen.additionalExpenses) / 100;

      // Fetch factory and product pricing
      const [factory] = await Factory.find().session(session);
      const productionPrice = await Product.findOne({ name: productName }).session(session);
      if (!factory || !productionPrice) {
        return response.notFound(res, "Zavod ma'lumotlari yoki narxlar topilmadi!");
      }

      // Validate input arrays
      if (!Array.isArray(consumedMaterials) || !Array.isArray(materialStatistics)) {
        return response.error(res, "Material ma'lumotlari noto‘g‘ri");
      }

      if (isDefective && !defectiveReason) {
        return response.error(res, "Brak mahsulot uchun sabab kiritilishi shart");
      }

      if (materialStatistics.length !== consumedMaterials.length) {
        return response.error(res, "Material statistikasi va ishlatilgan materiallar mos emas");
      }

      // Validate material statistics status
      for (const stat of materialStatistics) {
        if (!["exceed", "insufficient", "equal"].includes(stat.status)) {
          return response.error(res, `Noto‘g‘ri status: ${stat.status} uchun ${stat.materialName}`);
        }
      }

      const productNorma = await ProductNorma.findById(productNormaId).lean().session(session);
      if (!productNorma) {
        return response.notFound(res, "Mahsulot normasi topilmadi yoki xarajatlari aniqlanmagan");
      }

      // Calculate resource costs
      const electricityCostPerKWH = Number(factory.electricityPrice);
      const gasCostPerKWH = Number(factory.methaneGasPrice);
      const totalElectricityUsed = parseFloat((electricityConsumption || 0).toFixed(2));
      const totalGasUsed = parseFloat((gasConsumption || 0).toFixed(2));
      const totalElectricityCost = totalElectricityUsed * electricityCostPerKWH;
      const totalGasCost = totalGasUsed * gasCostPerKWH;

      // Calculate labor and loading costs
      const workerPayPerUnit = parseFloat(Number(productionPrice.productionCost).toFixed(2));
      const loadingPayPerUnit = parseFloat(Number(productionPrice.loadingCost).toFixed(2));
      const totalWorkerCost = workerPayPerUnit * quantity;
      const totalLoadingCost = loadingPayPerUnit * quantity;

      // Process materials
      const materialsUsed = [];
      let totalMaterialCost = 0;

      for (const consumed of consumedMaterials) {
        const material = await Material.findById(consumed.materialId).session(session);
        if (!material) {
          return response.notFound(res, `Material topilmadi: ID ${consumed.materialId}`);
        }

        const consumedQuantity = parseFloat(Number(consumed.quantity || 0).toFixed(2));
        const unitPrice = parseFloat(Number(material.price).toFixed(2));
        const cost = consumedQuantity * unitPrice;
        totalMaterialCost += cost;

        if (Number(material.quantity) < consumedQuantity) {
          return response.error(res, `Yetarli ${material.name} yo‘q. Kerak: ${consumedQuantity}, Mavjud: ${material.quantity}`);
        }

        material.quantity = parseFloat((Number(material.quantity) - consumedQuantity).toFixed(2));
        await material.save({ session });

        materialsUsed.push({
          materialId: material._id,
          materialName: material.name,
          quantityUsed: consumedQuantity,
          unitPrice,
        });
      }

      // Calculate total production cost
      const totalCostSum = parseFloat((
        totalMaterialCost +
        totalGasCost +
        totalElectricityCost +
        totalWorkerCost +
        totalLoadingCost +
        additionalAmount
      ).toFixed(2));

      const productionCost = totalCostSum / quantity;

      // Check for existing FinishedProduct
      let finishedProduct = await FinishedProduct.findOne({
        productName: productNorma.productName,
        marketType,
        isDefective,
      }).session(session);

      const defectiveInfo = isDefective
        ? { defectiveReason, defectiveDescription, defectiveDate: new Date() }
        : { defectiveReason: "", defectiveDescription: "", defectiveDate: null };

      if (finishedProduct) {
        // Update existing product
        finishedProduct.quantity += quantity;
        finishedProduct.productionCost = Math.max(finishedProduct.productionCost, productionCost);
        await finishedProduct.save({ session });
      } else {
        // Create new product
        finishedProduct = await FinishedProduct.create([{
          productName: productNorma.productName,
          category: productNorma.category,
          marketType,
          quantity,
          productionCost,
          sellingPrice: Number(productNorma.salePrice || 0),
          isDefective,
          defectiveInfo,
        }], { session })[0];
      }

      // Record production history
      await ProductionHistory.create([{
        productNormaId: productNorma._id,
        productName: productNorma.productName,
        quantityProduced: quantity,
        materialsUsed,
        materialStatistics,
        totalCost: totalCostSum,
        marketType,
        gasAmount: gasConsumption,
        electricity: electricityConsumption,
        isDefective,
        salePrice: Number(productNorma.salePrice),
        defectiveInfo: isDefective ? defectiveInfo : undefined,
      }], { session });

      // Handle special salary calculations
      const lowerProductName = productName.toLowerCase();
      if (lowerProductName.includes("ruberoid")) {
        await calculateRuberoidSalaries({
          producedCount: quantityToProduce,
          product_id: productNorma._id,
          date,
          session,
        });
      }

      if (lowerProductName.includes("polizol") || lowerProductName.includes("folygoizol")) {
        await calculatePolizolSalaries({
          producedCount: quantityToProduce,
          loadedCount: 0,
          session,
          date,
        });
      }

      await session.commitTransaction();
      return response.created(res, `✅ ${productNorma.productName} dan ${quantity} dona ishlab chiqarildi${isDefective ? " (Brak sifatida)" : ""}`, {
        totalCost: totalCostSum,
        materialStatistics,
        isDefective,
        defectiveInfo: isDefective ? defectiveInfo : undefined,
        totalElectricityUsed,
        totalGasUsed,
        totalElectricityCost,
        totalGasCost,
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
      const products = await FinishedProduct.find();
      return response.success(
        res,
        "Finished products retrieved successfully",
        products
      );
    } catch (error) {
      return response.serverError(
        res,
        "Failed to retrieve finished products",
        error.message
      );
    }
  }

  // Get production history
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
        return response.badRequest(res, "Invalid date format for startDate or endDate");
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
      })
        .populate("productNormaId")
        .sort({ createdAt: -1 });

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
        temperature,
        electricEnergy,
        boilingHours,
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

      await calculateOchisleniya(bn3Amount, finalBn5, date, session);

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
      await reCalculateBtm5Sale(btm5Sale, date, session);

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
        return response.badRequest(res, "Invalid date format for startDate or endDate");
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
}

module.exports = new ProductionSystem();
