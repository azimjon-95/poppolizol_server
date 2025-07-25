const mongoose = require("mongoose");
const Employee = require("../model/adminModel"); // Admins model
const SalaryPayment = require("../model/salaryPaymentmodel");
const Penalty = require("../model/penaltyModel");
const Expense = require("../model/expenseModel");
const response = require("../utils/response");

class SalaryService {
    // Ishchi uchun oylik ma'lumotlarini olish
    async getEmployeeSalaryInfo(req, res) {
        try {
            const { employeeId, month, year } = req.params;
            const monthNum = parseInt(month);
            const yearNum = parseInt(year);

            if (!mongoose.Types.ObjectId.isValid(employeeId) || monthNum < 1 || monthNum > 12 || yearNum < 2020) {
                return response.error(res, "Noto'g'ri employeeId, oy yoki yil");
            }

            const employee = await Employee.findById(employeeId).select("-password -unitHeadPassword");
            if (!employee) {
                return response.notFound(res, "Ishchi topilmadi");
            }

            // Oylik to'lov ma'lumotlarini olish
            let salaryPayment = await SalaryPayment.findOne({
                employeeId,
                month: monthNum,
                year: yearNum,
            });

            // Agar bu oy uchun yozuv yo'q bo'lsa, yangi yaratish
            if (!salaryPayment) {
                const penalties = await Penalty.find({
                    employeeId,
                    month: monthNum,
                    year: yearNum,
                    status: "aktiv",
                });
                const totalPenalty = penalties.reduce((sum, penalty) => sum + penalty.amount, 0);

                salaryPayment = new SalaryPayment({
                    employeeId,
                    month: monthNum,
                    year: yearNum,
                    baseSalary: employee.salary,
                    penaltyAmount: totalPenalty,
                    totalPaid: 0,
                    remainingAmount: employee.salary - totalPenalty,
                });
                await salaryPayment.save();
            }

            const penalties = await Penalty.find({
                employeeId,
                month: monthNum,
                year: yearNum,
                status: "aktiv",
            }).sort({ appliedDate: -1 });

            return response.success(res, "Ishchi oylik ma'lumotlari", {
                employee,
                salaryPayment,
                penalties,
            });
        } catch (error) {
            console.error("Get employee salary info error:", error);
            return response.serverError(res, "Oylik ma'lumotlarini olishda xatolik", error);
        }
    }

    // Ishchi jarimalarini olish
    async getEmployeePenalties(req, res) {
        try {
            const { employeeId, month, year } = req.params;
            const monthNum = parseInt(month);
            const yearNum = parseInt(year);

            if (!mongoose.Types.ObjectId.isValid(employeeId) || monthNum < 1 || monthNum > 12 || yearNum < 2020) {
                return response.error(res, "Noto'g'ri employeeId, oy yoki yil");
            }

            const penalties = await Penalty.find({
                employeeId,
                month: monthNum,
                year: yearNum,
                status: "aktiv",
            }).sort({ appliedDate: -1 });

            return response.success(res, "Ishchi jarimalari", penalties);
        } catch (error) {
            console.error("Get employee penalties error:", error);
            return response.serverError(res, "Jarimalarni olishda xatolik", error);
        }
    }

    // Barcha ishchilarning oylik ma'lumotlarini olish
    async getAllEmployeesSalaryInfo(req, res) {
        try {
            const { month, year } = req.params;
            const monthNum = parseInt(month);
            const yearNum = parseInt(year);

            if (monthNum < 1 || monthNum > 12 || yearNum < 2020) {
                return response.error(res, "Noto'g'ri oy yoki yil");
            }

            const employees = await Employee.find({ paymentType: "oylik" }).select(
                "firstName middleName lastName unit role salary passportSeries"
            );

            const salaryInfoPromises = employees.map(async (employee) => {
                const salaryInfo = await this.getEmployeeSalaryInfoInternal(employee._id, monthNum, yearNum);
                return {
                    ...employee.toObject(),
                    salaryPayment: salaryInfo.salaryPayment,
                    penalties: salaryInfo.penalties,
                };
            });

            const employeesData = await Promise.all(salaryInfoPromises);

            return response.success(res, "Barcha ishchilarning oylik ma'lumotlari", employeesData);
        } catch (error) {
            console.error("Get all employees salary info error:", error);
            return response.serverError(res, "Barcha oylik ma'lumotlarini olishda xatolik", error);
        }
    }

    // Internal helper for getAllEmployeesSalaryInfo
    async getEmployeeSalaryInfoInternal(employeeId, month, year) {
        const employee = await Employee.findById(employeeId).select("-password -unitHeadPassword");
        if (!employee) {
            throw new Error("Ishchi topilmadi");
        }

        let salaryPayment = await SalaryPayment.findOne({
            employeeId,
            month,
            year,
        });

        if (!salaryPayment) {
            const penalties = await Penalty.find({
                employeeId,
                month,
                year,
                status: "aktiv",
            });
            const totalPenalty = penalties.reduce((sum, penalty) => sum + penalty.amount, 0);

            salaryPayment = new SalaryPayment({
                employeeId,
                month,
                year,
                baseSalary: employee.salary,
                penaltyAmount: totalPenalty,
                totalPaid: 0,
                remainingAmount: employee.salary - totalPenalty,
            });
            await salaryPayment.save();
        }

        const penalties = await Penalty.find({
            employeeId,
            month,
            year,
            status: "aktiv",
        }).sort({ appliedDate: -1 });

        return {
            employee,
            salaryPayment,
            penalties,
        };
    }

    // Maosh to'lash
    async paySalary(req, res) {
        try {
            const { employeeId, month, year, amount, paymentMethod, description = "" } = req.body;

            if (!employeeId || !month || !year || !amount || !paymentMethod) {
                return response.error(res, "Barcha majburiy maydonlar to'ldirilishi kerak");
            }

            if (!mongoose.Types.ObjectId.isValid(employeeId)) {
                return response.error(res, "Noto'g'ri employeeId");
            }

            const monthNum = parseInt(month);
            const yearNum = parseInt(year);
            const paymentAmount = parseFloat(amount);

            if (monthNum < 1 || monthNum > 12 || yearNum < 2020) {
                return response.error(res, "Noto'g'ri oy yoki yil");
            }

            if (paymentAmount <= 0) {
                return response.error(res, "To'lov summasi 0 dan katta bo'lishi kerak");
            }

            const employee = await Employee.findById(employeeId).select("-password -unitHeadPassword");
            if (!employee) {
                return response.notFound(res, "Ishchi topilmadi");
            }

            let salaryPayment = await SalaryPayment.findOne({
                employeeId,
                month: monthNum,
                year: yearNum,
            });

            if (!salaryPayment) {
                const penalties = await Penalty.find({
                    employeeId,
                    month: monthNum,
                    year: yearNum,
                    status: "aktiv",
                });
                const totalPenalty = penalties.reduce((sum, penalty) => sum + penalty.amount, 0);

                salaryPayment = new SalaryPayment({
                    employeeId,
                    month: monthNum,
                    year: yearNum,
                    baseSalary: employee.salary,
                    penaltyAmount: totalPenalty,
                    totalPaid: 0,
                    remainingAmount: employee.salary - totalPenalty,
                });
            }

            // Expense yozuvini yaratish
            const expense = new Expense({
                relatedId: employeeId.toString(),
                type: "chiqim",
                paymentMethod,
                category: "oylik_maosh",
                amount: paymentAmount,
                description: `${employee.firstName} ${employee.lastName} - ${monthNum}/${yearNum} oy maoshi: ${description}`,
                date: new Date(),
            });

            const savedExpense = await expense.save();

            // To'lov tarixiga qo'shish
            const newPayment = {
                amount: paymentAmount,
                paymentMethod,
                description,
                expenseId: savedExpense._id,
                paymentDate: new Date(),
            };

            salaryPayment.paymentHistory.push(newPayment);
            salaryPayment.totalPaid += paymentAmount;
            salaryPayment.remainingAmount = salaryPayment.baseSalary - salaryPayment.penaltyAmount - salaryPayment.totalPaid;

            // Status yangilash
            if (salaryPayment.remainingAmount <= 0) {
                if (salaryPayment.remainingAmount < 0) {
                    salaryPayment.status = "ortiqcha_to'langan";
                    // Ortiqcha to'langan summani keyingi oyga o'tkazish
                    await this.handleOverpaymentInternal(employeeId, monthNum, yearNum, Math.abs(salaryPayment.remainingAmount));
                } else {
                    salaryPayment.status = "to'liq_to'langan";
                }
            }

            await salaryPayment.save();

            return response.success(res, "To'lov muvaffaqiyatli amalga oshirildi", {
                salaryPayment,
                expense: savedExpense,
            });
        } catch (error) {
            console.error("Pay salary error:", error);
            return response.serverError(res, "Maosh to'lashda xatolik", error);
        }
    }

    // Ortiqcha to'lovni keyingi oyga o'tkazish
    async handleOverpayment(req, res) {
        try {
            const { employeeId, month, year, overpaidAmount } = req.body;

            if (!employeeId || !month || !year || !overpaidAmount) {
                return response.error(res, "Barcha majburiy maydonlar to'ldirilishi kerak");
            }

            if (!mongoose.Types.ObjectId.isValid(employeeId)) {
                return response.error(res, "Noto'g'ri employeeId");
            }

            const monthNum = parseInt(month);
            const yearNum = parseInt(year);
            const overpaid = parseFloat(overpaidAmount);

            if (monthNum < 1 || monthNum > 12 || yearNum < 2020) {
                return response.error(res, "Noto'g'ri oy yoki yil");
            }

            if (overpaid <= 0) {
                return response.error(res, "Ortiqcha to'lov summasi 0 dan katta bo'lishi kerak");
            }

            const result = await this.handleOverpaymentInternal(employeeId, monthNum, yearNum, overpaid);

            return response.success(res, "Ortiqcha to'lov muvaffaqiyatli o'tkazildi", result);
        } catch (error) {
            console.error("Handle overpayment error:", error);
            return response.serverError(res, "Ortiqcha to'lovni o'tkazishda xatolik", error);
        }
    }

    // Internal helper for handleOverpayment
    async handleOverpaymentInternal(employeeId, currentMonth, currentYear, overpaidAmount) {
        try {
            let nextMonth = currentMonth + 1;
            let nextYear = currentYear;

            if (nextMonth > 12) {
                nextMonth = 1;
                nextYear += 1;
            }

            const employee = await Employee.findById(employeeId).select("-password -unitHeadPassword");
            if (!employee) {
                throw new Error("Ishchi topilmadi");
            }

            let nextMonthSalary = await SalaryPayment.findOne({
                employeeId,
                month: nextMonth,
                year: nextYear,
            });

            if (!nextMonthSalary) {
                const penalties = await Penalty.find({
                    employeeId,
                    month: nextMonth,
                    year: nextYear,
                    status: "aktiv",
                });
                const totalPenalty = penalties.reduce((sum, penalty) => sum + penalty.amount, 0);

                nextMonthSalary = new SalaryPayment({
                    employeeId,
                    month: nextMonth,
                    year: nextYear,
                    baseSalary: employee.salary,
                    penaltyAmount: totalPenalty,
                    totalPaid: overpaidAmount,
                    remainingAmount: employee.salary - totalPenalty - overpaidAmount,
                    advanceAmount: overpaidAmount,
                });

                nextMonthSalary.paymentHistory.push({
                    amount: overpaidAmount,
                    paymentMethod: "transfer",
                    description: `${currentMonth}/${currentYear} oydan o'tkazilgan ortiqcha to'lov`,
                    paymentDate: new Date(),
                });

                await nextMonthSalary.save();
            } else {
                nextMonthSalary.advanceAmount = (nextMonthSalary.advanceAmount || 0) + overpaidAmount;
                nextMonthSalary.totalPaid += overpaidAmount;
                nextMonthSalary.remainingAmount -= overpaidAmount;

                nextMonthSalary.paymentHistory.push({
                    amount: overpaidAmount,
                    paymentMethod: "transfer",
                    description: `${currentMonth}/${currentYear} oydan o'tkazilgan ortiqcha to'lov`,
                    paymentDate: new Date(),
                });

                await nextMonthSalary.save();
            }

            return nextMonthSalary;
        } catch (error) {
            console.error("Handle overpayment internal error:", error);
            throw error;
        }
    }

    // Jarima qo'shish
    async addPenalty(req, res) {
        try {
            const { employeeId, amount, reason, penaltyType, month, year, createdBy } = req.body;

            if (!employeeId || !amount || !reason || !month || !year || !createdBy) {
                return response.error(res, "Barcha majburiy maydonlar to'ldirilishi kerak");
            }

            if (!mongoose.Types.ObjectId.isValid(employeeId)) {
                return response.error(res, "Noto'g'ri employeeId");
            }

            const monthNum = parseInt(month);
            const yearNum = parseInt(year);
            const penaltyAmount = parseFloat(amount);

            if (monthNum < 1 || monthNum > 12 || yearNum < 2020) {
                return response.error(res, "Noto'g'ri oy yoki yil");
            }

            if (penaltyAmount <= 0) {
                return response.error(res, "Jarima summasi 0 dan katta bo'lishi kerak");
            }

            const employee = await Employee.findById(employeeId);
            if (!employee) {
                return response.notFound(res, "Ishchi topilmadi");
            }

            const penaltyData = {
                employeeId,
                amount: penaltyAmount,
                reason,
                penaltyType: penaltyType || "boshqa",
                month: monthNum,
                year: yearNum,
                createdBy,
                appliedDate: new Date(),
                status: "aktiv",
            };

            const penalty = new Penalty(penaltyData);
            await penalty.save();

            // Tegishli oylik ma'lumotlarni yangilash
            let salaryPayment = await SalaryPayment.findOne({
                employeeId,
                month: monthNum,
                year: yearNum,
            });

            if (salaryPayment) {
                salaryPayment.penaltyAmount = (salaryPayment.penaltyAmount || 0) + penaltyAmount;
                salaryPayment.remainingAmount = salaryPayment.baseSalary - salaryPayment.penaltyAmount - salaryPayment.totalPaid;
                await salaryPayment.save();
            }

            return response.success(res, "Jarima muvaffaqiyatli qo'shildi", penalty);
        } catch (error) {
            console.error("Add penalty error:", error);
            return response.serverError(res, "Jarima qo'shishda xatolik", error);
        }
    }

    // Oylik hisobotini olish
    async getMonthlySalaryReport(req, res) {
        try {
            const { month, year } = req.params;
            const monthNum = parseInt(month);
            const yearNum = parseInt(year);

            if (monthNum < 1 || monthNum > 12 || yearNum < 2020) {
                return response.error(res, "Noto'g'ri oy yoki yil");
            }

            const salaryPayments = await SalaryPayment.find({ month: monthNum, year: yearNum })
                .populate("employeeId", "firstName middleName lastName unit role")
                .sort({ "employeeId.firstName": 1 });

            const totalBaseSalary = salaryPayments.reduce((sum, payment) => sum + payment.baseSalary, 0);
            const totalPaid = salaryPayments.reduce((sum, payment) => sum + payment.totalPaid, 0);
            const totalPenalties = salaryPayments.reduce((sum, payment) => sum + payment.penaltyAmount, 0);
            const totalRemaining = salaryPayments.reduce((sum, payment) => sum + payment.remainingAmount, 0);

            return response.success(res, "Oylik hisobot", {
                salaryPayments,
                summary: {
                    totalBaseSalary,
                    totalPaid,
                    totalPenalties,
                    totalRemaining,
                    employeeCount: salaryPayments.length,
                },
            });
        } catch (error) {
            console.error("Get monthly salary report error:", error);
            return response.serverError(res, "Oylik hisobotini olishda xatolik", error);
        }
    }
}

module.exports = new SalaryService();