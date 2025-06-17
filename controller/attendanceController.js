const Attendance = require("../model/attendanceModal");
const Admin = require("../model/adminModel");
const Clinic = require("../model/clinicInfo");
const response = require("../utils/response");

class AttendanceController {
    // Default attendance settings (since removed from ClinicInfo)
    static attendanceSettings = {
        grace_period_minutes: 15,
        early_leave_threshold_minutes: 30,
        overtime_threshold_minutes: 30,
    };

    // Utility to get work schedule
    static async getWorkSchedule() {
        const clinic = await Clinic.findOne();
        if (!clinic) {
            throw new Error("Klinika topilmadi");
        }

        return {
            start_time: clinic.work_schedule.start_time,
            end_time: clinic.work_schedule.end_time,
            work_days: clinic.work_schedule.work_days,
            settings: this.attendanceSettings,
        };
    }

    // Check if today is a work day
    static isWorkDay(workDays) {
        const today = new Date();
        const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        return workDays.includes(dayNames[today.getDay()]);
    }

    // Parse time string (e.g., "08:00") to Date object for a given date
    static parseTimeToDate(timeStr, baseDate = new Date()) {
        const [hour, minute] = timeStr.split(":").map(Number);
        const date = new Date(baseDate);
        date.setHours(hour, minute, 0, 0);
        return date;
    }

    // Check-in logic
    static async checkIn(req, res) {
        try {
            const { employee_id } = req.body;
            const employee = await Admin.findById(employee_id);
            if (!employee) {
                return response.notFound(res, "Ishchi topilmadi");
            }

            const clinic = await Clinic.findOne();
            if (!clinic) {
                return response.error(res, "Klinika topilmadi");
            }

            const schedule = await this.getWorkSchedule();
            if (!this.isWorkDay(schedule.work_days)) {
                return response.error(res, "Bugun ish kuni emas");
            }

            const today = new Date().toISOString().split("T")[0];
            const checkInTime = new Date();

            const attendance = await Attendance.findOne({ employee_id, date: today });
            if (attendance?.check_in_time) {
                return response.error(res, "Bugun allaqachon kelgan", attendance);
            }

            const workStartTime = this.parseTimeToDate(schedule.start_time);
            const gracePeriodTime = new Date(workStartTime.getTime() + schedule.settings.grace_period_minutes * 60 * 1000);

            const lateMinutes = checkInTime > gracePeriodTime ? Math.floor((checkInTime - workStartTime) / (1000 * 60)) : 0;
            const status = lateMinutes > 0 ? "late" : "present";

            const newAttendance = attendance
                ? await Attendance.findByIdAndUpdate(
                    attendance._id,
                    { check_in_time: checkInTime, late_minutes: lateMinutes, status },
                    { new: true }
                )
                : new Attendance({
                    employee_id,
                    date: today,
                    check_in_time: checkInTime,
                    late_minutes: lateMinutes,
                    status,
                });

            await newAttendance.save();

            const populatedAttendance = await Attendance.findById(newAttendance._id).populate(
                "employee_id",
                "firstName lastName role"
            );

            return response.created(res, `${employee.firstName} ${employee.lastName} muvaffaqiyatli keldi`, {
                attendance: populatedAttendance,
                late_info: lateMinutes > 0 ? `${lateMinutes} minut kech qoldi` : null,
                work_start_time: schedule.start_time,
                grace_period: schedule.settings.grace_period_minutes,
            });
        } catch (error) {
            console.error("Check-in xatosi:", error);
            return response.serverError(res, "Server xatosi", error.message);
        }
    }

    // Check-out logic
    static async checkOut(req, res) {
        try {
            const { employee_id } = req.body;
            const today = new Date().toISOString().split("T")[0];
            const checkOutTime = new Date();

            const attendance = await Attendance.findOne({ employee_id, date: today });
            if (!attendance || !attendance.check_in_time) {
                return response.error(res, "Bugun kelish vaqti qayd etilmagan");
            }
            if (attendance.check_out_time) {
                return response.error(res, "Bugun allaqachon ketgan", attendance);
            }

            const employee = await Admin.findById(employee_id);
            const schedule = await this.getWorkSchedule();

            const workEndTime = this.parseTimeToDate(schedule.end_time);
            const earlyLeaveThreshold = new Date(workEndTime.getTime() - schedule.settings.early_leave_threshold_minutes * 60 * 1000);
            const overtimeThreshold = new Date(workEndTime.getTime() + schedule.settings.overtime_threshold_minutes * 60 * 1000);

            const totalWorkMinutes = Math.floor((checkOutTime - attendance.check_in_time) / (1000 * 60));
            let earlyLeaveMinutes = 0;
            let overtimeMinutes = 0;
            let status = attendance.status;

            if (checkOutTime < earlyLeaveThreshold) {
                earlyLeaveMinutes = Math.floor((workEndTime - checkOutTime) / (1000 * 60));
                status = "early_leave";
            } else if (checkOutTime > overtimeThreshold) {
                overtimeMinutes = Math.floor((checkOutTime - workEndTime) / (1000 * 60));
                if (overtimeMinutes > 0) status = "overtime";
            }

            const updatedAttendance = await Attendance.findByIdAndUpdate(
                attendance._id,
                {
                    check_out_time: checkOutTime,
                    early_leave_minutes: earlyLeaveMinutes,
                    overtime_minutes: overtimeMinutes,
                    total_work_minutes: totalWorkMinutes,
                    status,
                },
                { new: true }
            ).populate("employee_id", "firstName lastName role");

            const workHours = Math.floor(totalWorkMinutes / 60);
            const workMinutes = totalWorkMinutes % 60;

            return response.success(res, "Muvaffaqiyatli ketdi", {
                attendance: updatedAttendance,
                work_summary: {
                    total_work_time: `${workHours} soat ${workMinutes} minut`,
                    overtime: overtimeMinutes > 0 ? `${Math.floor(overtimeMinutes / 60)} soat ${overtimeMinutes % 60} minut ortiqcha` : null,
                    early_leave: earlyLeaveMinutes > 0 ? `${Math.floor(earlyLeaveMinutes / 60)} soat ${earlyLeaveMinutes % 60} minut erta ketdi` : null,
                    work_end_time: schedule.end_time,
                },
            });
        } catch (error) {
            console.error("Check-out xatosi:", error);
            return response.serverError(res, "Server xatosi", error.message);
        }
    }

    // NFC scan logic (using employee_id)
    static async nfcScan(req, res) {
        try {
            const { employee_id } = req.body;
            const employee = await Admin.findById(employee_id);
            if (!employee) {
                return response.notFound(res, "Ishchi topilmadi");
            }

            const clinic = await Clinic.findOne();
            if (!clinic) {
                return response.error(res, "Klinika topilmadi");
            }

            const today = new Date().toISOString().split("T")[0];
            const attendance = await Attendance.findOne({ employee_id, date: today });

            const tempReq = { body: { employee_id } };

            if (!attendance || !attendance.check_in_time) {
                return this.checkIn(tempReq, res);
            } else if (!attendance.check_out_time) {
                return this.checkOut(tempReq, res);
            } else {
                const populatedAttendance = await Attendance.findById(attendance._id).populate(
                    "employee_id",
                    "firstName lastName role"
                );
                return response.success(res, "Bugun allaqachon to'liq davomat qayd etilgan", {
                    attendance: populatedAttendance,
                    work_summary: {
                        total_work_time: `${Math.floor(attendance.total_work_minutes / 60)} soat ${attendance.total_work_minutes % 60} minut`,
                        check_in_time: attendance.check_in_time,
                        check_out_time: attendance.check_out_time,
                    },
                });
            }
        } catch (error) {
            console.error("NFC scan xatosi:", error);
            return response.serverError(res, "Server xatosi", error.message);
        }
    }

    // Daily report
    static async getDailyReport(req, res) {
        try {
            const { date } = req.query;
            const targetDate = date || new Date().toISOString().split("T")[0];

            const attendances = await Attendance.find({ date: targetDate })
                .populate("employee_id", "firstName lastName role specialization")
                .sort({ check_in_time: 1 });

            const summary = {
                total_employees: attendances.length,
                present: attendances.filter((a) => a.check_in_time).length,
                late: attendances.filter((a) => a.late_minutes > 0).length,
                early_leave: attendances.filter((a) => a.early_leave_minutes > 0).length,
                overtime: attendances.filter((a) => a.overtime_minutes > 0).length,
            };

            return response.success(res, "Kunlik hisobot", { date: targetDate, summary, attendances });
        } catch (error) {
            console.error("Hisobot xatosi:", error);
            return response.serverError(res, "Server xatosi", error.message);
        }
    }

    // Employee history
    static async getEmployeeHistory(req, res) {
        try {
            const { employee_id } = req.params;
            const { start_date, end_date } = req.query;

            const dateFilter = { employee_id };
            if (start_date && end_date) {
                dateFilter.date = { $gte: start_date, $lte: end_date };
            }

            const history = await Attendance.find(dateFilter)
                .populate("employee_id", "firstName lastName role")
                .sort({ date: -1 });

            return response.success(res, "Ishchi tarixi", { employee_id, history });
        } catch (error) {
            console.error("Tarix xatosi:", error);
            return response.serverError(res, "Server xatosi", error.message);
        }
    }
}

module.exports = AttendanceController;