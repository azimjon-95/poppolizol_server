const ClinicInfo = require("../model/clinicInfo");
const response = require("../utils/response");

class ClinicInfoController {
  // Klinikani yaratish
  async createClinicInfo(req, res) {
    try {
      const clinic = await ClinicInfo.create(req.body);
      if (!clinic) return response.error(res, "malumot saqlashda hatolik");
      return response.success(res, "Klinika ma'lumotlari yaratildi", clinic);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  // Klinikani yangilash (faqat bitta bo'lishi mumkin deb hisoblanadi)
  async updateClinicInfo(req, res) {
    try {
      const clinic = await ClinicInfo.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      if (!clinic) return response.notFound(res, "Klinika topilmadi");
      return response.success(res, "Klinika ma'lumotlari yangilandi", clinic);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  // Klinikani olish (barcha yoki bitta)
  async getClinicInfo(req, res) {
    try {
      const clinics = await ClinicInfo.find();
      if (!clinics.length) return response.notFound(res, "Klinika topilmadi");
      return response.success(res, "Success", clinics[0]);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }
  // Klinikani o'chirish
  async deleteClinicInfo(req, res) {
    try {
      const clinic = await ClinicInfo.findByIdAndDelete(req.params.id);
      if (!clinic) return response.notFound(res, "Klinika topilmadi");
      return response.success(res, "Klinika ma'lumotlari o'chirildi", clinic);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }
}

module.exports = new ClinicInfoController();
