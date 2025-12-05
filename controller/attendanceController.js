const mongoose = require("mongoose");
const Attendance = require("../model/attendanceModal");
const Admins = require("../model/adminModel");
const response = require("../utils/response");

const calculateLoadedPrices = require("../controller/calculateSalary/calculateLoadedPrices");
const reCalculateGlobalSalaries = require("../controller/calculateSalary/globalCalculate");

const SalaryRecord = require("../model/salaryRecord");

class AttendanceController {
  async markAttendance(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const {
        employeeId,
        date,
        percentage,
        department: unit,
        cleaning,
      } = req.body;

      if (!unit) {
        await session.abortTransaction();
        session.endSession();
        return response.warning(res, "Bo‘lim tanlanmagan");
      }

      if (!employeeId || !date || !percentage) {
        await session.abortTransaction();
        session.endSession();
        return response.warning(res, "Majburiy maydonlar to'ldirilmagan");
      }

      const allowedPercentages = [0.33, 0.5, 0.75, 1, 1.5, 2];
      if (!allowedPercentages.includes(percentage)) {
        await session.abortTransaction();
        session.endSession();
        return response.warning(res, "Noto'g'ri davomat foizi kiritildi");
      }

      if (!mongoose.Types.ObjectId.isValid(employeeId)) {
        await session.abortTransaction();
        session.endSession();
        return response.error(res, "Noto'g'ri xodim ID si");
      }

      const user = await Admins.findById(employeeId).session(session);
      if (!user) {
        await session.abortTransaction();
        session.endSession();
        return response.error(res, "Xodim topilmadi");
      }

      if (user.role !== "ishlab chiqarish") {
        if (user?.role === "boshqa ishchilar") {
          const result1 = await Attendance.create(
            [
              {
                employee: employeeId,
                date: new Date(date),
                percentage,
                unit,
              },
            ],
            { session }
          );

          // TO‘G‘RI: Transaksiyani yakunlash (saqlash)
          await session.commitTransaction(); // SAQLAYDI
          session.endSession();

          return response.success(
            res,
            "Davomat muvaffaqiyatli saqlandi",
            result1
          );
        }
      }

      let realPercentage = percentage;
      const managerialUnits = [
        "polizol ish boshqaruvchi",
        "rubiroid ish boshqaruvchi",
        "Okisleniya ish boshqaruvchi",
      ];
      if (managerialUnits.includes(user.unit)) {
        realPercentage = +(Number(percentage) + 0.2).toFixed(2);
      }

      let today = new Date(date);
      today.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today.getTime() + 86399999);

      let cleanSalaryRecord = await SalaryRecord.findOne({
        date: { $gte: today, $lte: endOfDay },
        type: "cleaning",
      });

      if (!cleaning && cleanSalaryRecord) {
        await session.abortTransaction();
        session.endSession();
        return response.warning(
          res,
          "Bugun shanbalik uchun davomat saqlay olasiz"
        );
      }

      let attendanceRecord;
      if (user.unit === "avto kara") {
        attendanceRecord = await Attendance.create(
          [
            {
              employee: employeeId,
              date: new Date(date),
              percentage,
              unit: unit,
            },
          ],
          { session }
        );
        if (!cleaning) {
          let unitForSalary = user.unit.includes("rubiroid")
            ? "ruberoid"
            : unit;

          await reCalculateGlobalSalaries(unitForSalary, date, session);
          await calculateLoadedPrices(date, session);
        }
      } else {
        attendanceRecord = await Attendance.findOneAndUpdate(
          { employee: employeeId, date: new Date(date) },
          {
            employee: employeeId,
            date: new Date(date),
            percentage: realPercentage,
            // unit: user.unit,
            unit,
          },
          { upsert: true, new: true, session }
        );
        if (!cleaning) {
          let unitForSalary = user.unit.includes("rubiroid")
            ? "ruberoid"
            : // : user.unit;
              unit;

          await reCalculateGlobalSalaries(unitForSalary, date, session);
          await calculateLoadedPrices(date, session);
        }
      }

      if (cleaning) {
        let today = new Date(date);
        today.setHours(0, 0, 0, 0);
        const endOfDay = new Date(today.getTime() + 86399999);

        let salaryRecord = await SalaryRecord.findOne({
          date: { $gte: today, $lte: endOfDay },
          type: "cleaning",
        });

        if (!salaryRecord) {
          let result = await SalaryRecord.create(
            [
              {
                date: new Date(date),
                type: "cleaning",
                amount: cleaning,
                department: unit.toLowerCase().includes("okisleniya")
                  ? "Okisleniya"
                  : unit.toLowerCase().includes("polizol")
                  ? "polizol"
                  : unit,
                totalSum: 120000 * percentage,
                salaryPerPercent: 120000 * percentage,
                workers: [
                  {
                    employee: employeeId,
                    percentage: percentage,
                    amount: 120000 * percentage,
                  },
                ],
              },
            ],
            { session }
          );
        } else {
          const todayAttendances = await Attendance.find({
            date: { $gte: today, $lte: endOfDay },
            unit: unit,
          })
            .populate("employee")
            .session(session);

          if (todayAttendances.length === 0) return null;

          const totalPercentage = todayAttendances.reduce(
            (sum, a) => sum + a.percentage,
            0
          );

          let totalSum = totalPercentage * 120000;
          let salaryPerPercent = totalSum / totalPercentage;

          // agar worker mavjud bo'lsa amount qo'shamiz, aks holda yangi yozuv qo'shamiz
          const existingIdx = salaryRecord.workers.findIndex(
            (w) => w.employee.toString() === employeeId.toString()
          );
          const addAmount = 120000 * percentage;
          if (existingIdx >= 0) {
            salaryRecord.workers[existingIdx].amount =
              (salaryRecord.workers[existingIdx].amount || 0) + addAmount;
            // agar kerak bo'lsa percentage yangilash:
            salaryRecord.workers[existingIdx].percentage = percentage;
          } else {
            salaryRecord.workers.push({
              employee: employeeId,
              percentage: percentage,
              amount: addAmount,
            });
          }

          salaryRecord.totalSum = salaryRecord.workers.reduce(
            (sum, w) => sum + w.amount,
            0
          );
          salaryRecord.salaryPerPercent = salaryPerPercent;

          await salaryRecord.save({ session });
        }
      }

      // await updateSalaryRecordForDate(unit, date, session);

      let unitForSalary = unit.includes("rubiroid") ? "ruberoid" : unit;
      if (!cleaning) {
        await reCalculateGlobalSalaries(unitForSalary, date, session);
        await calculateLoadedPrices(date, session);
      }
      await session.commitTransaction();
      session.endSession();

      return response.success(
        res,
        "Davomat muvaffaqiyatli saqlandi",
        attendanceRecord
      );
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Mark attendance error:", error);
      return response.serverError(
        res,
        "Davomatni saqlashda xatolik yuz berdi",
        error
      );
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
        "Okisleniya",
        "Okisleniya ish boshqaruvchi",
        "boshqa",
      ];
      if (!validUnits.includes(unit)) {
        return response.error(res, "Noto'g'ri bo‘lim kiritildi");
      }

      const attendance = await Attendance.findById(attendanceId).populate(
        "employee"
      );
      if (!attendance) {
        return response.error(res, "Davomat topilmadi");
      }

      // Check if the provided unit matches the employee's unit
      if (attendance.employee.unit !== unit) {
        return response.error(
          res,
          "Kiritilgan bo‘lim xodimning bo‘limiga mos kelmaydi"
        );
      }

      let realPercentage = percentage;
      const managerialUnits = [
        "polizol ish boshqaruvchi",
        "rubiroid ish boshqaruvchi",
        "Okisleniya ish boshqaruvchi",
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
      return response.serverError(
        res,
        "Davomatni yangilashda xatolik yuz berdi",
        error
      );
    }
  }

  async deleteAttendance(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { attendanceId, unit } = req.body;

      if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
        await session.abortTransaction();
        session.endSession();
        return response.error(res, "Noto'g'ri davomat ID si");
      }

      let user = await Attendance.findById(attendanceId).session(session);

      if (!user) {
        await session.abortTransaction();
        session.endSession();
        return response.error(res, "Davomat topilmadi");
      }

      await Attendance.findByIdAndDelete(attendanceId).session(session);

      let unitForSalary = user.unit.includes("rubiroid")
        ? "ruberoid"
        : user.unit;

      await reCalculateGlobalSalaries(unitForSalary, user?.date, session);
      await calculateLoadedPrices(user?.date, session);
      await session.commitTransaction();
      session.endSession();
      return response.success(res, "Davomat muvaffaqiyatli o'chirildi", null);
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      return response.serverError(
        res,
        "Davomatni o'chirishda xatolik yuz berdi",
        error
      );
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
