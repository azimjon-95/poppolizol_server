const Norma = require("../model/productNormaSchema");
const { Factory } = require("../model/factoryModel");
const Material = require("../model/wherehouseModel");
const response = require("../utils/response");

class NormaController {
  async getNorma(req, res) {
    try {
      const norma = await Norma.find().populate({
        path: "materials.materialId",
      });
      if (!norma.length) {
        return response.notFound(res, "Normalar topilmadi!");
      }
      return response.success(res, "Barcha normalar", norma);
    } catch (error) {
      return response.serverError(res, "Ma'lumotlarni olishda xato yuz berdi", error.message);
    }
  }

  async createNorma(req, res) {
    try {
      const { productName, category, salePrice, materials, description, cost } = req.body;

      // Validate required fields
      if (!productName || !materials || !cost) {
        return response.error(res, "Mahsulot nomi, materiallar yoki xarajatlar kiritilmagan");
      }

      // Fetch factory data
      const factory = await Factory.findOne().select("electricityPrice methaneGasPrice");
      if (!factory) {
        return response.error(res, "Zavod ma'lumotlari topilmadi");
      }

      // Fetch material data
      const materialData = await Material.find().select("price");
      if (!materialData || materialData.length === 0) {
        return response.error(res, "Material ma'lumotlari topilmadi");
      }

      // Calculate material cost
      let materialCost = 0;
      for (const item of materials) {
        const material = materialData.find(mat => mat._id.toString() === item.materialId);
        if (!material) {
          return response.error(res, `Material ID ${item.materialId} topilmadi`);
        }
        materialCost += material.price * item.quantity;
      }

      // Calculate utility costs
      const gasCost = cost.gasPerUnit * factory.methaneGasPrice;
      const electricityCost = cost.electricityPerUnit * factory.electricityPrice;

      // Adjust otherExpenses to 1% of its original value
      const adjustedOtherExpenses = cost.otherExpenses * 0.01;

      // Calculate total cost
      const totalCost = materialCost + gasCost + electricityCost + cost.laborCost + adjustedOtherExpenses;

      // Create and save Norma document
      const norma = await Norma.create({
        productName,
        category: category || null,
        salePrice,
        materials,
        description: description || null,
        size: req.body.size || null,
        cost: {
          gasPerUnit: cost.gasPerUnit,
          electricityPerUnit: cost.electricityPerUnit,
          laborCost: cost.laborCost,
          otherExpenses: adjustedOtherExpenses, // Save adjusted otherExpenses
          totalCost, // Save calculated totalCost
        },
      });

      return response.success(res, "Norma muvaffaqiyatli yaratildi", norma);
    } catch (error) {
      return response.serverError(res, "Norma yaratishda xato yuz berdi", error.message);
    }
  }

  async updateNorma(req, res) {
    try {
      const { id } = req.params;
      const { productName, category, materials, salePrice, description, size, cost } = req.body;

      // Validate required fields
      if (!productName || !materials || !cost) {
        return response.error(res, "Mahsulot nomi, materiallar yoki xarajatlar kiritilmagan");
      }

      // Fetch factory data
      const factory = await Factory.findOne().select("electricityPrice methaneGasPrice").lean();
      if (!factory) {
        return response.error(res, "Zavod ma'lumotlari topilmadi");
      }

      // Fetch material data for provided material IDs
      const materialIds = materials.map(item => item.materialId);
      const materialData = await Material.find({ _id: { $in: materialIds } }).select("price").lean();
      if (!materialData || materialData.length !== materialIds.length) {
        return response.error(res, "Bir yoki bir nechta materiallar topilmadi");
      }

      // Calculate material cost
      let materialCost = 0;
      for (const item of materials) {
        const material = materialData.find(mat => mat._id.toString() === item.materialId);
        materialCost += material.price * item.quantity;
      }

      // Calculate utility costs
      const gasCost = cost.gasPerUnit * factory.methaneGasPrice;
      const electricityCost = cost.electricityPerUnit * factory.electricityPrice;

      // Adjust otherExpenses to 1% of its original value
      const adjustedOtherExpenses = cost.otherExpenses * 0.01;

      // Calculate total cost
      const totalCost = materialCost + gasCost + electricityCost + cost.laborCost + adjustedOtherExpenses;

      // Update Norma document
      const norma = await Norma.findByIdAndUpdate(
        id,
        {
          productName,
          category: category || null,
          salePrice,
          materials,
          description: description || null,
          size: size || null,
          cost: {
            gasPerUnit: cost.gasPerUnit,
            electricityPerUnit: cost.electricityPerUnit,
            laborCost: cost.laborCost,
            otherExpenses: adjustedOtherExpenses,
            totalCost,
          },
        },
        { new: true, runValidators: true }
      ).lean();

      if (!norma) {
        return response.notFound(res, "Norma topilmadi");
      }

      return response.success(res, "Norma yangilandi", norma);
    } catch (error) {
      return response.serverError(res, "Norma yangilashda xato yuz berdi", error.message);
    }
  }

  async deleteNorma(req, res) {
    try {
      const { id } = req.params;
      if (!id || !mongoose.isValidObjectId(id)) {
        return response.error(res, "Noto'g'ri ID formati");
      }
      const norma = await Norma.findByIdAndDelete(id);
      if (!norma) {
        return response.notFound(res, "Norma topilmadi");
      }
      return response.success(res, "Norma o'chirildi", norma);
    } catch (error) {
      return response.serverError(res, "Norma o'chirishda xato yuz berdi", error.message);
    }
  }
}

module.exports = new NormaController();

