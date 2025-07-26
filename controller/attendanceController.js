const mongoose = require("mongoose");
const Attendance = require("../model/attendanceModal");
const Admins = require("../model/adminModel");
const response = require("../utils/response");

class AttendanceController {
  async markAttendance(req, res) {
    try {
      const { employeeId, date, percentage, department: unit } = req.body;

      if (!unit) {
        return response.warning(res, "Bo‘lim tanlanmagan");
      }

      if (!employeeId || !date || !percentage) {
        return response.warning(res, "Majburiy maydonlar to'ldirilmagan");
      }

      const allowedPercentages = [0.33, 0.5, 0.75, 1, 1.5, 2];
      if (!allowedPercentages.includes(percentage)) {
        return response.warning(res, "Noto'g'ri davomat foizi kiritildi");
      }

      // Validate employeeId
      if (!mongoose.Types.ObjectId.isValid(employeeId)) {
        return response.error(res, "Noto'g'ri xodim ID si");
      }

      // Check if employee exists and get their unit
      const user = await Admins.findById(employeeId);
      if (!user) {
        return response.error(res, "Xodim topilmadi");
      }

      // Check if the provided unit matches the employee's unit
      if (user.role !== "ishlab chiqarish") {
        return response.error(res, "Kiritilgan bo‘lim xodimning bo‘limiga mos kelmaydi");
      }

      let realPercentage = percentage;

      // Apply bonus for managerial units
      const managerialUnits = [
        "polizol ish boshqaruvchi",
        "rubiroid ish boshqaruvchi",
        "ochisleniya ish boshqaruvchi",
      ];
      if (managerialUnits.includes(user.unit)) {
        realPercentage = +(Number(percentage) + 0.2).toFixed(2);
      }

      // Special handling for transport unit
      if (user.unit === "avto kara") {
        const attendanceRecord = await Attendance.create({
          employee: employeeId,
          date: new Date(date),
          percentage,
          unit,
        });

        return response.success(
          res,
          "Davomat muvaffaqiyatli saqlandi",
          attendanceRecord
        );
      }

      // Upsert attendance record for non-transport units
      const attendanceRecord = await Attendance.findOneAndUpdate(
        { employee: employeeId, date: new Date(date) },
        {
          employee: employeeId,
          date: new Date(date),
          percentage: realPercentage,
          unit,
        },
        { upsert: true, new: true }
      );

      return response.success(
        res,
        "Davomat muvaffaqiyatli saqlandi",
        attendanceRecord
      );
    } catch (error) {
      console.error("Mark attendance error:", error);
      return response.serverError(res, "Davomatni saqlashda xatolik yuz berdi", error);
    }
  }

  async updateAttendance(req, res) {
    try {
      const { attendanceId, percentage, date, unit } = req.body;

      if (!attendanceId) {
        return response.warning(res, "Davomat ID si kiritilmagan");
      }

      if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
        return response.error(res, "Noto'g'ri davomat ID si");
      }

      if (!percentage || !date || !unit) {
        return response.warning(res, "Majburiy maydonlar to'ldirilmagan");
      }

      const allowedPercentages = [0.33, 0.5, 0.75, 1, 1.5, 2];
      if (!allowedPercentages.includes(percentage)) {
        return response.warning(res, "Noto'g'ri davomat foizi kiritildi");
      }

      const validUnits = [
        "direktor",
        "buxgalteriya",
        "menejir",
        "ombor",
        "sifat nazorati",
        "elektrik",
        "transport",
        "xavfsizlik",
        "tozalash",
        "oshxona",
        "sotuvchi",
        "sotuvchi eksport",
        "sotuvchi menejir",
        "polizol",
        "polizol ish boshqaruvchi",
        "rubiroid",
        "rubiroid ish boshqaruvchi",
        "ochisleniya",
        "ochisleniya ish boshqaruvchi",
        "boshqa",
      ];
      if (!validUnits.includes(unit)) {
        return response.error(res, "Noto'g'ri bo‘lim kiritildi");
      }

      const attendance = await Attendance.findById(attendanceId).populate('employee');
      if (!attendance) {
        return response.error(res, "Davomat topilmadi");
      }

      // Check if the provided unit matches the employee's unit
      if (attendance.employee.unit !== unit) {
        return response.error(res, "Kiritilgan bo‘lim xodimning bo‘limiga mos kelmaydi");
      }

      let realPercentage = percentage;
      const managerialUnits = [
        "polizol ish boshqaruvchi",
        "rubiroid ish boshqaruvchi",
        "ochisleniya ish boshqaruvchi",
      ];
      if (managerialUnits.includes(attendance.employee.unit)) {
        realPercentage = +(Number(percentage) + 0.2).toFixed(2);
      }

      const updatedAttendance = await Attendance.findByIdAndUpdate(
        attendanceId,
        {
          date: new Date(date),
          percentage: realPercentage,
          unit,
        },
        { new: true }
      ).populate("employee", "firstName lastName unit role");

      return response.success(
        res,
        "Davomat muvaffaqiyatli yangilandi",
        updatedAttendance
      );
    } catch (error) {
      console.error("Update attendance error:", error);
      return response.serverError(res, "Davomatni yangilashda xatolik yuz berdi", error);
    }
  }

  async deleteAttendance(req, res) {
    try {
      const { attendanceId, unit } = req.body;

      if (!attendanceId) {
        return response.warning(res, "Davomat ID si kiritilmagan");
      }

      if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
        return response.error(res, "Noto'g'ri davomat ID si");
      }

      if (!unit) {
        return response.warning(res, "Bo‘lim kiritilmagan");
      }

      const validUnits = [
        "direktor",
        "buxgalteriya",
        "menejir",
        "ombor",
        "sifat nazorati",
        "elektrik",
        "transport",
        "xavfsizlik",
        "tozalash",
        "oshxona",
        "avto kara",
        "sotuvchi",
        "sotuvchi eksport",
        "sotuvchi menejir",
        "polizol",
        "polizol ish boshqaruvchi",
        "rubiroid",
        "rubiroid ish boshqaruvchi",
        "ochisleniya",
        "ochisleniya ish boshqaruvchi",
        "boshqa",
      ];

      if (!validUnits.includes(unit)) {
        return response.error(res, "Noto'g'ri bo‘lim kiritildi");
      }

      const attendance = await Attendance.findById(attendanceId);
      if (!attendance) {
        return response.error(res, "Davomat topilmadi");
      }

      // Check if the provided unit matches the attendance record's unit
      if (unit === "ochisleniya" && attendance.unit !== "ochisleniya") {
        return response.error(res, "Bu davomat ochisleniya bo‘limiga tegishli emas");
      }

      await Attendance.findByIdAndDelete(attendanceId);

      return response.success(res, "Davomat muvaffaqiyatli o'chirildi", null);
    } catch (error) {
      console.error("Delete attendance error:", error);
      return response.serverError(res, "Davomatni o'chirishda xatolik yuz berdi", error);
    }
  }

  async getAttendanceHistory(req, res) {
    try {
      const { employeeId, startDate, endDate } = req.query;

      if (!employeeId) {
        return response.warning(res, "Xodim ID si kiritilmagan");
      }

      if (!mongoose.Types.ObjectId.isValid(employeeId)) {
        return response.error(res, "Noto'g'ri xodim ID si");
      }

      const filter = { employee: employeeId };

      if (startDate && endDate) {
        filter.date = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }

      const history = await Attendance.find(filter)
        .populate("employee", "firstName lastName unit role")
        .sort({ date: 1 });

      return response.success(res, "Davomat tarixi olindi", history);
    } catch (error) {
      console.error("Get attendance history error:", error);
      return response.serverError(
        res,
        "Davomat tarixini olishda xatolik yuz berdi",
        error
      );
    }
  }

  async getAllAttendanceByDateRange(req, res) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return response.warning(
          res,
          "Boshlanish va tugash sanalari kiritilmagan"
        );
      }

      const filter = {
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      };

      const records = await Attendance.find(filter)
        .populate("employee", "firstName lastName unit role")
        .sort({ date: 1 });

      return response.success(res, "Barcha xodimlarning davomatlari", records);
    } catch (error) {
      console.error("Get all attendance error:", error);
      return response.serverError(
        res,
        "Davomatlarni olishda xatolik yuz berdi",
        error
      );
    }
  }
}

module.exports = new AttendanceController();