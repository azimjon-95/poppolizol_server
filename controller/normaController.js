const Norma = require("../model/productNormaSchema");
const response = require("../utils/response");

class NormaController {
  async getNorma(req, res) {
    try {
      const norma = await Norma.find().populate("materials.materialId");
      if (!norma.length) {
        return response.notFound(res, "Normalar topilmadi1");
      }
      return response.success(res, "Barcha normalar", norma);
    } catch (error) {
      return response.serverError(res, error.message, err);
    }
  }

  async createNorma(req, res) {
    try {
      const norma = await Norma.create(req.body);
      if (!norma) {
        return response.error(res, "Norma yaratilmadi");
      }
      return response.success(res, "Norma yaratildi", norma);
    } catch (error) {
      return response.serverError(res, error.message, error);
    }
  }

  async updateNorma(req, res) {
    try {
      const norma = await Norma.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });
      if (!norma) {
        return response.notFound(res, "Norma topilmadi");
      }
      return response.success(res, "Norma yangilandi", norma);
    } catch (error) {
      return response.serverError(res, error.message, err);
    }
  }
  async deleteNorma(req, res) {
    try {
      const norma = await Norma.findByIdAndDelete(req.params.id);
      if (!norma) {
        return response.notFound(res, "Norma topilmadi");
      }
      return response.success(res, "Norma o'chirildi", norma);
    } catch (error) {
      return response.serverError(res, error.message, err);
    }
  }
}

module.exports = new NormaController();
