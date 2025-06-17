const Material = require("../model/wherehouseModel");
const response = require("../utils/response");

class MaterialController {
  async getAll(req, res) {
    try {
      const materials = await Material.find();
      if (!materials.length) {
        return response.notFound(res, "No materials found");
      }
      return response.success(res, "materialLAR topildi", materials);
    } catch (error) {
      return response.error(res, error.message, err);
    }
  }

  async create(req, res) {
    try {
      const material = await Material.create(req.body);
      if (!material) {
        return response.notFound(res, "Material qo'shilmadi");
      }
      return response.success(res, "Material qo'shildi", material);
    } catch (error) {
      return response.error(res, error.message, err);
    }
  }

  // Update material by ID
  async update(req, res) {
    try {
      const { id } = req.params;
      const material = await Material.findByIdAndUpdate(id, req.body, {
        new: true,
      });
      if (!material) {
        return response.notFound(res, "Material topilmadi");
      }
      return response.success(res, "Material yangilandi", material);
    } catch (error) {
      return response.error(res, error.message, err);
    }
  }

  // Delete material by ID
  async delete(req, res) {
    try {
      const { id } = req.params;
      const material = await Material.findByIdAndDelete(id);
      if (!material) {
        return response.notFound(res, "Material topilmadi");
      }
      return response.success(res, "Material o'chirildi", material);
    } catch (error) {
      return response.error(res, error.message, err);
    }
  }
}

module.exports = new MaterialController();
