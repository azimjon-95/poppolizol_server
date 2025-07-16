const Attendance = require("../model/attendanceModal");
const Admins = require("../model/adminModel");
const response = require("../utils/response");

class AttendanceController {
  async markAttendance(req, res) {
    try {
      const { employeeId, date, percentage, department } = req.body;

      if (!department) {
        return response.warning(res, "Bo‘lim  tanlanmagan");
      }

      if (!employeeId || !date || !percentage) {
        return response.warning(res, "Majburiy maydonlar to'ldirilmagan");
      }

      const allowedPercentages = [0.33, 0.5, 0.75, 1, 1.5, 2];
      if (!allowedPercentages.includes(percentage)) {
        return response.warning(res, "Noto'g'ri davomat foizi kiritildi");
      }

      let exactEmployee = await Attendance.findOne({
        employee: employeeId,
        date: new Date(date),
      }).populate("employee");

      let realPercentage = percentage;

      let user = await Admins.findById(employeeId);

      if (user.position === "Bo'lim boshlig'i") {
        realPercentage = +(Number(percentage) + 0.2).toFixed(2);
      }

      if (exactEmployee?.employee?.department === "transport") {
        const attendanceRecord = await Attendance.create({
          employee: employeeId,
          date: new Date(date),
          percentage,
          unit: department,
        });

        return response?.success(
          res,
          "Davomat muvaffaqiyatli saqlandi",
          attendanceRecord
        );
      }

      const attendanceRecord = await Attendance.findOneAndUpdate(
        { employee: employeeId, date: new Date(date) },
        {
          employee: employeeId,
          date: new Date(date),
          percentage: realPercentage,
          unit: department,
        },
        { upsert: true, new: true }
      );

      return response?.success(
        res,
        "Davomat muvaffaqiyatli saqlandi",
        attendanceRecord
      );
    } catch (error) {
      console.error("xxxx", error);
      return response.serverError(res, error.message, error);
    }
  }

  async getAttendanceHistory(req, res) {
    try {
      const { employeeId, startDate, endDate } = req.query;

      if (!employeeId) {
        return response.warning(res, "Hodim ID si kiritilmagan");
      }

      const filter = { employee: employeeId };

      if (startDate && endDate) {
        filter.date = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }

      const history = await Attendance.find(filter).sort({ date: 1 });

      return response.success(res, "Davomat tarixi olindi", history);
    } catch (error) {
      console.error("Get attendance history error:", error);
      return response.serverError(
        res,
        "Davomat tarixini olishda xatolik yuz berdi"
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
        .populate("employee", "firstName lastName position") // employee haqida info qo‘shish
        .sort({ date: 1 });

      return response.success(res, "Barcha hodimlarning davomatlari", records);
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
