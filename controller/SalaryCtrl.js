const Employee = require('../model/adminModel'); // Admins model
const SalaryPayment = require('../model/salaryPaymentmodel');
const Penalty = require('../model/penaltyModel');
const Expense = require('../model/expenseModel');

class SalaryService {
    // Ishchi uchun oylik ma'lumotlarini olish
    async getEmployeeSalaryInfo(req, res) {
        try {
            const { employeeId, month, year } = req.params;
            const monthNum = parseInt(month);
            const yearNum = parseInt(year);

            if (!employeeId || monthNum < 1 || monthNum > 12 || yearNum < 2020) {
                return res.status(400).json({
                    success: false,
                    message: "Noto'g'ri employeeId, oy yoki yil",
                });
            }

            const employee = await Employee.findById(employeeId);
            if (!employee) {
                return res.status(404).json({
                    success: false,
                    message: 'Ishchi topilmadi',
                });
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
                    status: 'aktiv',
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
                status: 'aktiv',
            }).sort({ appliedDate: -1 });

            return res.json({
                success: true,
                data: {
                    employee,
                    salaryPayment,
                    penalties,
                },
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    // Ishchi jarimalarini olish
    async getEmployeePenalties(req, res) {
        try {
            const { employeeId, month, year } = req.params;
            const monthNum = parseInt(month);
            const yearNum = parseInt(year);

            if (!employeeId || monthNum < 1 || monthNum > 12 || yearNum < 2020) {
                return res.status(400).json({
                    success: false,
                    message: "Noto'g'ri employeeId, oy yoki yil",
                });
            }

            const penalties = await Penalty.find({
                employeeId,
                month: monthNum,
                year: yearNum,
                status: 'aktiv',
            }).sort({ appliedDate: -1 });

            return res.json({
                success: true,
                data: penalties,
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    // Barcha ishchilarning oylik ma'lumotlarini olish
    async getAllEmployeesSalaryInfo(req, res) {
        try {
            const { month, year } = req.params;
            const monthNum = parseInt(month);
            const yearNum = parseInt(year);
            console.log(monthNum, yearNum);

            if (monthNum < 1 || monthNum > 12 || yearNum < 2020) {
                return res.status(400).json({
                    success: false,
                    message: "Noto'g'ri oy yoki yil",
                });
            }

            const employees = await Employee.find({ paymentType: 'oylik' })
                .select('firstName middleName lastName department position salary passportSeries');

            const salaryInfoPromises = employees.map(async (employee) => {
                const salaryInfo = await this.getEmployeeSalaryInfoInternal(employee._id, monthNum, yearNum);
                return {
                    ...employee.toObject(),
                    salaryPayment: salaryInfo.salaryPayment,
                    penalties: salaryInfo.penalties,
                };
            });

            const employeesData = await Promise.all(salaryInfoPromises);

            return res.json({
                success: true,
                data: employeesData,
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    // Internal helper for getAllEmployeesSalaryInfo
    async getEmployeeSalaryInfoInternal(employeeId, month, year) {
        const employee = await Employee.findById(employeeId);
        if (!employee) {
            throw new Error('Ishchi topilmadi');
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
                status: 'aktiv',
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
            status: 'aktiv',
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
            const { employeeId, month, year, amount, paymentMethod, description = '' } = req.body;

            if (!employeeId || !month || !year || !amount || !paymentMethod) {
                return res.status(400).json({
                    success: false,
                    message: "Barcha majburiy maydonlar to'ldirilishi kerak",
                });
            }

            if (parseFloat(amount) <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "To'lov summasi 0 dan katta bo'lishi kerak",
                });
            }

            const monthNum = parseInt(month);
            const yearNum = parseInt(year);
            const paymentAmount = parseFloat(amount);

            if (monthNum < 1 || monthNum > 12 || yearNum < 2020) {
                return res.status(400).json({
                    success: false,
                    message: "Noto'g'ri oy yoki yil",
                });
            }

            const employee = await Employee.findById(employeeId);
            if (!employee) {
                return res.status(404).json({
                    success: false,
                    message: 'Ishchi topilmadi',
                });
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
                    status: 'aktiv',
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
                type: 'chiqim',
                paymentMethod,
                category: 'oylik_maosh',
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
                    salaryPayment.status = 'ortiqcha_to\'langan';
                    // Ortiqcha to'langan summani keyingi oyga o'tkazish
                    await this.handleOverpaymentInternal(employeeId, monthNum, yearNum, Math.abs(salaryPayment.remainingAmount));
                } else {
                    salaryPayment.status = 'to\'liq_to\'langan';
                }
            }

            await salaryPayment.save();

            return res.json({
                success: true,
                message: "To'lov muvaffaqiyatli amalga oshirildi",
                data: {
                    salaryPayment,
                    expense: savedExpense,
                },
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    // Ortiqcha to'lovni keyingi oyga o'tkazish
    async handleOverpayment(req, res) {
        try {
            const { employeeId, month, year, overpaidAmount } = req.body;

            if (!employeeId || !month || !year || !overpaidAmount) {
                return res.status(400).json({
                    success: false,
                    message: "Barcha majburiy maydonlar to'ldirilishi kerak",
                });
            }

            if (parseFloat(overpaidAmount) <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Ortiqcha to'lov summasi 0 dan katta bo'lishi kerak",
                });
            }

            const monthNum = parseInt(month);
            const yearNum = parseInt(year);
            const overpaid = parseFloat(overpaidAmount);

            if (monthNum < 1 || monthNum > 12 || yearNum < 2020) {
                return res.status(400).json({
                    success: false,
                    message: "Noto'g'ri oy yoki yil",
                });
            }

            const result = await this.handleOverpaymentInternal(employeeId, monthNum, yearNum, overpaid);

            return res.json({
                success: true,
                message: "Ortiqcha to'lov muvaffaqiyatli o'tkazildi",
                data: result,
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
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

            const employee = await Employee.findById(employeeId);
            if (!employee) {
                throw new Error('Ishchi topilmadi');
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
                    status: 'aktiv',
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
                    paymentMethod: 'transfer',
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
                    paymentMethod: 'transfer',
                    description: `${currentMonth}/${currentYear} oydan o'tkazilgan ortiqcha to'lov`,
                    paymentDate: new Date(),
                });

                await nextMonthSalary.save();
            }

            return nextMonthSalary;
        } catch (error) {
            console.error("Ortiqcha to'lovni o'tkazishda xatolik:", error);
            throw error;
        }
    }

    // Jarima qo'shish
    async addPenalty(req, res) {
        try {
            const { employeeId, amount, reason, penaltyType, month, year, createdBy } = req.body;

            if (!employeeId || !amount || !reason || !month || !year || !createdBy) {
                return res.status(400).json({
                    success: false,
                    message: "Barcha majburiy maydonlar to'ldirilishi kerak",
                });
            }

            if (parseFloat(amount) <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Jarima summasi 0 dan katta bo'lishi kerak",
                });
            }

            const monthNum = parseInt(month);
            const yearNum = parseInt(year);
            const penaltyAmount = parseFloat(amount);

            if (monthNum < 1 || monthNum > 12 || yearNum < 2020) {
                return res.status(400).json({
                    success: false,
                    message: "Noto'g'ri oy yoki yil",
                });
            }

            const penaltyData = {
                employeeId,
                amount: penaltyAmount,
                reason,
                penaltyType: penaltyType || 'boshqa',
                month: monthNum,
                year: yearNum,
                createdBy,
                appliedDate: new Date(),
                status: 'aktiv',
            };

            const penalty = new Penalty(penaltyData);
            await penalty.save();

            // Tegishli oylik ma'lumotlarni yangilash
            const salaryPayment = await SalaryPayment.findOne({
                employeeId,
                month: monthNum,
                year: yearNum,
            });

            if (salaryPayment) {
                salaryPayment.penaltyAmount = (salaryPayment.penaltyAmount || 0) + penaltyAmount;
                salaryPayment.remainingAmount = salaryPayment.baseSalary - salaryPayment.penaltyAmount - salaryPayment.totalPaid;
                await salaryPayment.save();
            }

            return res.json({
                success: true,
                message: "Jarima muvaffaqiyatli qo'shildi",
                data: penalty,
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    // Oylik hisobotini olish
    async getMonthlySalaryReport(req, res) {
        try {
            const { month, year } = req.params;
            const monthNum = parseInt(month);
            const yearNum = parseInt(year);

            if (monthNum < 1 || monthNum > 12 || yearNum < 2020) {
                return res.status(400).json({
                    success: false,
                    message: "Noto'g'ri oy yoki yil",
                });
            }

            const salaryPayments = await SalaryPayment.find({ month: monthNum, year: yearNum })
                .populate('employeeId', 'firstName middleName lastName department position')
                .sort({ 'employeeId.firstName': 1 });

            const totalBaseSalary = salaryPayments.reduce((sum, payment) => sum + payment.baseSalary, 0);
            const totalPaid = salaryPayments.reduce((sum, payment) => sum + payment.totalPaid, 0);
            const totalPenalties = salaryPayments.reduce((sum, payment) => sum + payment.penaltyAmount, 0);
            const totalRemaining = salaryPayments.reduce((sum, payment) => sum + payment.remainingAmount, 0);

            return res.json({
                success: true,
                data: {
                    salaryPayments,
                    summary: {
                        totalBaseSalary,
                        totalPaid,
                        totalPenalties,
                        totalRemaining,
                        employeeCount: salaryPayments.length,
                    },
                },
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
}

module.exports = new SalaryService();