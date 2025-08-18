const Bonus = require("../model/bonusModel");
const response = require("../utils/response");

class BonusController {
  // Bonus yaratish
  async create(req, res) {
    try {
      const created = await Bonus.create(req.body);
      if (!created) return response.error(res, 400, "Bonus yaratilmadi");
      response.success(res, "Bonus qo'shildi", created);
    } catch (err) {
      if (err.name === "ValidationError") {
        return response.error(res, "Ma'lumotlar noto'g'ri", err.message);
      }
      response.serverError(res, "Serverda xatolik yuz berdi", err.message);
    }
  }

  // async getAll(req, res) {
  //   try {
  //     let allData = await Bonus.find(req.query)
  //       .populate("employeeId")
  //       .sort({ createdAt: -1 });
  //     if (!allData || allData.length === 0) {
  //       return response.notFound(res, "Bonuslar topilmadi");
  //     }
  //     response.success(res, "Barcha bonuslar", allData);
  //   } catch (err) {
  //     response.serverError(res, "Serverda xatolik yuz berdi", err.message);
  //   }
  // }

  async getAll(req, res) {
    try {
      const { startDate, endDate } = req.query;

      // 1) Filter obyekti (req.query ni to'g'ridan-to'g'ri bermaymiz!)
      const filter = {};

      // 2) Sana oralig'i
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        // endDate ni kun oxiriga qo'yamiz (23:59:59.999)
        end.setHours(23, 59, 59, 999);

        // start va end valid ekanini tekshirish
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          filter.createdAt = { $gte: start, $lte: end };
        }
      } else {
        // Joriy oy oraliği (default)
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        lastDay.setHours(23, 59, 59, 999);

        filter.createdAt = { $gte: firstDay, $lte: lastDay };
      }

      const allData = await Bonus.find(filter)
        .populate("employeeId")
        .sort({ createdAt: -1 });

      if (!allData || allData.length === 0) {
        return response.notFound(res, "Bonuslar topilmadi");
      }

      return response.success(res, "Barcha bonuslar", allData);
    } catch (err) {
      return response.serverError(
        res,
        "Serverda xatolik yuz berdi",
        err.message
      );
    }
  }

  // Bonusni ID bo‘yicha olish
  async getById(req, res) {
    try {
      const bonus = await Bonus.find({ employeeId: req.params.id });
      if (!bonus?.length) return response.notFound(res, "Bonus topilmadi");
      response.success(res, "Bonus topildi", bonus);
    } catch (err) {
      response.serverError(res, "Serverda xatolik yuz berdi", err.message);
    }
  }

  // Bonusni yangilash
  async update(req, res) {
    try {
      const { id } = req.params;
      console.log(id);

      const updated = await Bonus.findByIdAndUpdate(id, req.body, {
        new: true,
      });
      if (!updated) return response.notFound(res, "Bonus topilmadi");
      response.success(res, "Bonus yangilandi", updated);
    } catch (err) {
      response.serverError(res, "Serverda xatolik yuz berdi", err.message);
    }
  }

  // Bonusni o‘chirish
  async delete(req, res) {
    try {
      const { id } = req.params;
      const deleted = await Bonus.findByIdAndDelete(id);
      if (!deleted) return response.notFound(res, "Bonus topilmadi");
      response.success(res, "Bonus o'chirildi", deleted);
    } catch (err) {
      response.serverError(res, "Serverda xatolik yuz berdi", err.message);
    }
  }
}

module.exports = new BonusController();
