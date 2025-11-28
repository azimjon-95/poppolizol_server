const mongoose = require("mongoose");
const Employee = require("../model/adminModel"); // Admins model
const SalaryPayment = require("../model/salaryPaymentmodel");
const Penalty = require("../model/penaltyModel");
const Expense = require("../model/expenseModel");
const Balance = require("../model/balance");
const response = require("../utils/response");
const Bonus = require("../model/bonusModel");

const getEmployeeSalaryInfoInternal = async (
  employeeId,
  month,
  year,
  session = null
) => {
  const employee = await Employee.findById(employeeId).select(
    "-password -unitHeadPassword"
  );
  if (!employee) throw new Error("Ishchi topilmadi");

  // Avvalgi oylardan qarzlarni o'tkazish (iterativ)
  let carriedDebt = 0;
  let tempMonth = month - 1;
  let tempYear = year;
  const previousPayments = [];
  while (true) {
    if (tempMonth < 1) {
      tempMonth = 12;
      tempYear--;
    }
    if (tempYear < 2020) break; // Xavfsizlik cheklovi

    const prevSalaryPayment = await SalaryPayment.findOne({
      employeeId,
      month: tempMonth,
      year: tempYear,
    }).session(session);

    if (!prevSalaryPayment) break;
    if (
      prevSalaryPayment.remainingAmount >= 0 ||
      prevSalaryPayment.status === "qarz_otkazilgan"
    )
      break;

    carriedDebt += -prevSalaryPayment.remainingAmount;
    previousPayments.push(prevSalaryPayment);

    tempMonth--;
  }

  // Avvalgi oylarni yangilash
  for (const p of previousPayments) {
    p.remainingAmount = 0;
    p.status = "qarz_otkazilgan";
    await p.save({ session });
  }

  let salaryPayment = await SalaryPayment.findOne({
    employeeId,
    month,
    year,
  }).session(session);

  // Jarimalar
  const penalties = await Penalty.find({
    employeeId,
    month,
    year,
    status: "aktiv",
  }).sort({ appliedDate: -1 });

  // const totalPenalty = penalties.reduce((sum, p) => sum + p.amount, 0);
  const totalPenalty = (penalties || []).reduce(
    (sum, p) => sum + (p.amount || 0),
    0
  );

  // Sana oraliqlari
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  // Yuk tushirish puli
  const incomeWorkerPayments = await mongoose.model("Income").aggregate([
    {
      $match: {
        date: { $gte: startDate, $lte: endDate },
        "workerPayments.workerId": employee._id,
      },
    },
    { $unwind: "$workerPayments" },
    { $match: { "workerPayments.workerId": employee._id } },
    { $group: { _id: null, total: { $sum: "$workerPayments.payment" } } },
  ]);
  const unloadingSalary = incomeWorkerPayments[0]?.total || 0;

  // Ishbay / kunlik hisoblash
  let productionSalary = 0;
  let dailySalary = 0;

  if (employee.paymentType === "ishbay") {
    const salaryRecords = await mongoose.model("SalaryRecord").find({
      "workers.employee": employee._id,
      date: { $gte: startDate, $lte: endDate },
    });

    // productionSalary = salaryRecords.reduce((sum, record) => {
    //   const empEntries = record.workers.filter(
    //     (w) => w.employee.toString() === employee._id.toString()
    //   );
    //   return sum + empEntries.reduce((s, w) => s + (w.amount || 0), 0);
    // }, 0);
    productionSalary = (salaryRecords || []).reduce((sum, record) => {
      const rows = (record?.workers || []).filter(
        (w) => String(w.employee) === String(employee._id)
      );
      return sum + rows.reduce((s, w) => s + (w.amount || 0), 0);
    }, 0);
  }

  if (employee.paymentType === "kunlik") {
    const attendances = await mongoose.model("Attendance").find({
      employee: employee._id,
      date: { $gte: startDate, $lte: endDate },
    });
    dailySalary = attendances.length * employee.salary;
  }

  // === BONUSlarni shu oy uchun yig‘amiz (YYYY-MM bo‘yicha) ===
  const period = `${year}-${String(month).padStart(2, "0")}`;
  const bonusQuery = Bonus.find({ employeeId, period });
  const bonuses = session
    ? await bonusQuery.session(session).lean()
    : await bonusQuery.lean();
  const bonusSum = (bonuses || []).reduce((sum, b) => sum + (b.amount || 0), 0);

  // === BONUSlarni===

  const calculatedBaseSalary =
    ((employee.paymentType === "ishbay"
      ? productionSalary
      : employee.paymentType === "kunlik"
        ? dailySalary
        : employee.salary || 0) || 0) +
    (unloadingSalary || 0) +
    (bonusSum || 0);

  // Yangi hujjat yoki yangilash
  if (!salaryPayment) {
    salaryPayment = new SalaryPayment({
      employeeId,
      month,
      year,
      baseSalary: calculatedBaseSalary,
      penaltyAmount: totalPenalty,
      totalPaid: 0,
      remainingAmount: calculatedBaseSalary - totalPenalty - carriedDebt,
      advanceDebt: carriedDebt,
    });
  } else {
    // Yangi qarz qo‘shilmasin, faqat eski qarz o‘zgarishsiz qoladi
    if (!salaryPayment.advanceDebt || salaryPayment.advanceDebt === 0) {
      salaryPayment.advanceDebt = carriedDebt;
    }

    salaryPayment.baseSalary = calculatedBaseSalary;
    salaryPayment.penaltyAmount = totalPenalty;
    // salaryPayment.remainingAmount =
    //   calculatedBaseSalary -
    //   totalPenalty -
    //   salaryPayment.totalPaid -
    //   salaryPayment.advanceDebt;

    const paid = salaryPayment?.totalPaid || 0;
    const adv = salaryPayment?.advanceDebt || 0;

    salaryPayment.remainingAmount =
      (calculatedBaseSalary || 0) - (totalPenalty || 0) - paid - adv;
  }

  // Agar advanceDebt bor bo‘lsa va remainingAmount < 0 bo‘lsa — avans qoplanmoqda
  if (salaryPayment.advanceDebt > 0 || salaryPayment.remainingAmount < 0) {
    salaryPayment.status = "avans_qoplanmoqda";
  } else if (salaryPayment.remainingAmount <= 0) {
    salaryPayment.status =
      salaryPayment.remainingAmount < 0
        ? "ortiqcha_to'langan"
        : "to'liq_to'langan";
  } else {
    salaryPayment.status = "to'liq_to'lanmagan";
  }

  await salaryPayment.save({ session });

  return { employee, salaryPayment, penalties };
};

const handleOverpaymentInternal = async (
  employeeId,
  currentMonth,
  currentYear,
  paymentHistory,
  overpaidAmount
) => {
  try {
    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;

    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }

    const employee = await Employee.findById(employeeId).select(
      "-password -unitHeadPassword"
    );
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
      const totalPenalty = penalties.reduce(
        (sum, penalty) => sum + penalty.amount,
        0
      );

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
        paymentHistory,
        description: `${currentMonth}/${currentYear} oydan o'tkazilgan ortiqcha to'lov`,
        paymentDate: new Date(),
      });

      await nextMonthSalary.save();
    } else {
      nextMonthSalary.advanceAmount =
        (nextMonthSalary.advanceAmount || 0) + overpaidAmount;
      nextMonthSalary.totalPaid += overpaidAmount;
      nextMonthSalary.remainingAmount -= overpaidAmount;

      nextMonthSalary.paymentHistory.push({
        amount: overpaidAmount,
        paymentMethod: "transfer",
        paymentHistory,
        description: `${currentMonth}/${currentYear} oydan o'tkazilgan ortiqcha to'lov`,
        paymentDate: new Date(),
      });

      await nextMonthSalary.save();
    }

    return nextMonthSalary;
  } catch (error) {
    throw error;
  }
};

class SalaryService {
  // Ishchi uchun oylik ma'lumotlarini olish
  async getEmployeeSalaryInfo(req, res) {
    try {
      const { employeeId, month, year } = req.params;
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);

      if (
        !mongoose.Types.ObjectId.isValid(employeeId) ||
        monthNum < 1 ||
        monthNum > 12 ||
        yearNum < 2020
      ) {
        return response.error(res, "Noto'g'ri employeeId, oy yoki yil");
      }

      const { employee, salaryPayment, penalties } =
        await getEmployeeSalaryInfoInternal(employeeId, monthNum, yearNum);

      return response.success(res, "Ishchi oylik ma'lumotlari", {
        employee,
        salaryPayment,
        penalties,
      });
    } catch (error) {
      return response.serverError(
        res,
        "Oylik ma'lumotlarini olishda xatolik",
        error
      );
    }
  }

  async getAllEmployeesSalaryInfo(req, res) {
    try {
      const { month, year } = req.params;
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);

      if (monthNum < 1 || monthNum > 12 || yearNum < 2020) {
        return response.error(res, "Noto'g'ri oy yoki yil");
      }

      // Barcha ishchilarni olish
      const allEmployees = await Employee.find({
        paymentType: { $in: ["oylik", "ishbay", "kunlik"] },
      }).select(
        "firstName middleName lastName unit role salary passportSeries paymentType"
      );

      const allSalaryInfoPromises = allEmployees.map(async (employee) => {
        const salaryInfo = await getEmployeeSalaryInfoInternal(
          employee._id,
          monthNum,
          yearNum
        );

        return {
          ...employee.toObject(),
          salaryPayment: salaryInfo.salaryPayment,
          penalties: salaryInfo.penalties,
          type: employee.paymentType,
        };
      });

      const allEmployeesData = await Promise.all(allSalaryInfoPromises);

      // Ikkita turga ajratamiz (agar frontendda kerak bo‘lsa)
      const monthly = allEmployeesData.filter((e) => e.type === "oylik");
      const daily = allEmployeesData.filter(
        (e) => e.type === "ishbay" || e.type === "kunlik"
      );

      return response.success(
        res,
        "Barcha ishchilarning oylik va ishbay ma'lumotlari",
        {
          monthly,
          daily,
        }
      );
    } catch (error) {
      return response.serverError(
        res,
        "Barcha oylik ma'lumotlarini olishda xatolik",
        error
      );
    }
  }

  // Ishchi jarimalarini olish
  async getEmployeePenalties(req, res) {
    try {
      const { employeeId, month, year } = req.params;
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);

      if (
        !mongoose.Types.ObjectId.isValid(employeeId) ||
        monthNum < 1 ||
        monthNum > 12 ||
        yearNum < 2020
      ) {
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
      return response.serverError(res, "Jarimalarni olishda xatolik", error);
    }
  }

  async paySalary(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const {
        employeeId,
        month,
        year,
        amount,
        paymentMethod,
        salaryType,
        description = "",
      } = req.body;

      if (
        !employeeId ||
        !month ||
        !year ||
        !amount ||
        !paymentMethod ||
        !salaryType
      ) {
        return response.error(
          res,
          "Barcha majburiy maydonlar to'ldirilishi kerak"
        );
      }

      const monthNum = parseInt(month);
      const yearNum = parseInt(year);
      const paymentAmount = parseFloat(amount);

      if (paymentAmount <= 0) {
        return response.error(res, "To'lov summasi 0 dan katta bo'lishi kerak");
      }

      const { employee, salaryPayment } = await getEmployeeSalaryInfoInternal(
        employeeId,
        monthNum,
        yearNum,
        session
      );

      // Avans bo‘lsa — advanceDebt ga qo‘shiladi
      if (salaryType === "avans") {
        salaryPayment.advanceDebt += paymentAmount;
        salaryPayment.remainingAmount -= paymentAmount;
        salaryPayment.status = "avans_qoplanmoqda";
      } else {
        // Oddiy oylik to‘lash
        salaryPayment.totalPaid += paymentAmount;
        salaryPayment.remainingAmount =
          salaryPayment.baseSalary -
          salaryPayment.penaltyAmount -
          salaryPayment.totalPaid -
          salaryPayment.advanceDebt;

        // Agar avans qarzi mavjud bo‘lsa, to‘lov avval qarzga ketadi
        if (salaryPayment.advanceDebt > 0) {
          const debtCover = Math.min(paymentAmount, salaryPayment.advanceDebt);
          salaryPayment.advanceDebt -= debtCover;
          if (
            salaryPayment.advanceDebt <= 0 &&
            salaryPayment.remainingAmount <= 0
          ) {
            salaryPayment.status = "to'liq_to'langan";
          }
        } else if (salaryPayment.remainingAmount <= 0) {
          salaryPayment.status =
            salaryPayment.remainingAmount < 0
              ? "ortiqcha_to'langan"
              : "to'liq_to'langan";
        }
      }

      // Pul balansidan chiqim
      await Balance.updateBalance(
        paymentMethod,
        "chiqim",
        paymentAmount,
        session
      );

      // Expense yozuvi
      const expense = new Expense({
        relatedId: employeeId.toString(),
        type: "chiqim",
        paymentMethod,
        category: salaryType === "oylik" ? "Oylik maosh" : "Avans",
        amount: paymentAmount,
        description: `${employee.firstName} ${employee.lastName} - ${monthNum}/${yearNum} ${salaryType}: ${description}`,
        date: new Date(),
      });

      const savedExpense = await expense.save({ session });

      // Payment tarixiga qo‘shish
      salaryPayment.paymentHistory.push({
        amount: paymentAmount,
        paymentMethod,
        salaryType,
        description,
        expenseId: savedExpense._id,
        paymentDate: new Date(),
      });

      await salaryPayment.save({ session });

      await session.commitTransaction();
      return response.success(res, "To'lov muvaffaqiyatli amalga oshirildi", {
        salaryPayment,
        expense: savedExpense,
      });
    } catch (error) {
      await session.abortTransaction();
      return response.serverError(res, "Maosh to'lashda xatolik", error);
    } finally {
      session.endSession();
    }
  }

  // Ortiqcha to'lovni keyingi oyga o'tkazish
  async handleOverpayment(req, res) {
    try {
      const { employeeId, month, year, overpaidAmount, paymentHistory } =
        req.body;

      if (!employeeId || !month || !year || !overpaidAmount) {
        return response.error(
          res,
          "Barcha majburiy maydonlar to'ldirilishi kerak"
        );
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
        return response.error(
          res,
          "Ortiqcha to'lov summasi 0 dan katta bo'lishi kerak"
        );
      }

      const result = await handleOverpaymentInternal(
        employeeId,
        monthNum,
        yearNum,
        paymentHistory,
        overpaid
      );

      return response.success(
        res,
        "Ortiqcha to'lov muvaffaqiyatli o'tkazildi",
        result
      );
    } catch (error) {
      return response.serverError(
        res,
        "Ortiqcha to'lovni o'tkazishda xatolik",
        error
      );
    }
  }

  // Jarima qo'shish
  async addPenalty(req, res) {
    try {
      // Extract data from request body
      const {
        amount,
        appliedDate: createdBy,
        penaltyType,
        reason,
      } = req.body.penaltyData || {};
      const { employeeId } = req.body;

      // Validate required fields
      if (!employeeId || !amount || !reason || !createdBy) {
        return response.error(
          res,
          "Barcha majburiy maydonlar to'ldirilishi kerak"
        );
      }

      // Validate employeeId
      if (!mongoose.Types.ObjectId.isValid(employeeId)) {
        return response.error(res, "Noto'g'ri employeeId");
      }

      // Parse createdBy date to extract month and year
      const appliedDate = new Date(createdBy);
      if (isNaN(appliedDate)) {
        return response.error(res, "Noto'g'ri sana formati");
      }
      const monthNum = appliedDate.getMonth() + 1; // getMonth() returns 0-11, so add 1
      const yearNum = appliedDate.getFullYear();

      // Validate month and year
      if (monthNum < 1 || monthNum > 12 || yearNum < 2020) {
        return response.error(res, "Noto'g'ri oy yoki yil");
      }

      // Parse and validate penalty amount
      const penaltyAmount = parseFloat(amount);
      if (penaltyAmount <= 0) {
        return response.error(res, "Jarima summasi 0 dan katta bo'lishi kerak");
      }

      // Check if employee exists
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return response.notFound(res, "Ishchi topilmadi");
      }

      // Create penalty record
      const penaltyData = {
        employeeId,
        amount: penaltyAmount,
        reason,
        penaltyType: penaltyType || "boshqa",
        month: monthNum,
        year: yearNum,
        createdBy,
        appliedDate: appliedDate,
        status: "aktiv",
      };

      const penalty = new Penalty(penaltyData);
      await penalty.save();

      // Update or create salary payment record
      let salaryPayment = await SalaryPayment.findOne({
        employeeId,
        month: monthNum,
        year: yearNum,
      });

      if (salaryPayment) {
        // Update existing salary payment
        salaryPayment.penaltyAmount =
          (salaryPayment.penaltyAmount || 0) + penaltyAmount;
        salaryPayment.remainingAmount =
          salaryPayment.baseSalary -
          salaryPayment.penaltyAmount -
          salaryPayment.totalPaid -
          salaryPayment.advanceDebt;

        // Update status based on remaining amount
        if (
          salaryPayment.advanceDebt > 0 ||
          salaryPayment.remainingAmount < 0
        ) {
          salaryPayment.status = "avans_qoplanmoqda";
        } else if (salaryPayment.remainingAmount > 0) {
          salaryPayment.status = "to'liq_to'lanmagan";
        } else if (salaryPayment.remainingAmount === 0) {
          salaryPayment.status = "to'liq_to'langan";
        } else {
          salaryPayment.status = "ortiqcha_to'langan";
        }

        await salaryPayment.save();
      } else {
        // Create new salary payment record
        salaryPayment = new SalaryPayment({
          employeeId,
          month: monthNum,
          year: yearNum,
          baseSalary: 0, // Adjust to fetch from Employee or req.body if needed
          penaltyAmount,
          totalPaid: 0,
          remainingAmount: -penaltyAmount,
          status: "to'liq_to'lanmagan",
        });
        await salaryPayment.save();
      }

      return response.success(res, "Jarima muvaffaqiyatli qo'shildi", penalty);
    } catch (error) {
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

      const salaryPayments = await SalaryPayment.find({
        month: monthNum,
        year: yearNum,
      })
        .populate("employeeId", "firstName middleName lastName unit role")
        .sort({ "employeeId.firstName": 1 });

      const totalBaseSalary = salaryPayments.reduce(
        (sum, payment) => sum + payment.baseSalary,
        0
      );
      const totalPaid = salaryPayments.reduce(
        (sum, payment) => sum + payment.totalPaid,
        0
      );
      const totalPenalties = salaryPayments.reduce(
        (sum, payment) => sum + payment.penaltyAmount,
        0
      );
      const totalRemaining = salaryPayments.reduce(
        (sum, payment) => sum + payment.remainingAmount,
        0
      );

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
      return response.serverError(
        res,
        "Oylik hisobotini olishda xatolik",
        error
      );
    }
  }

  async getEmployeeFinanceHistory(req, res) {
    try {
      const { employeeId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(employeeId)) {
        return response.error(res, "Noto'g'ri employeeId");
      }

      // To'lovlar (SalaryPayment.paymentHistory)
      const salaryData = await SalaryPayment.find({
        employeeId,
      }).select("paymentHistory");

      let payments = [];
      salaryData.forEach((salary) => {
        salary.paymentHistory.forEach((ph) => {
          payments.push({
            type: "payment",
            amount: ph.amount,
            paymentMethod: ph.paymentMethod,
            salaryType: ph.salaryType,
            description: ph.description,
            date: ph.paymentDate,
          });
        });
      });

      // Jarimalar
      const penalties = await Penalty.find({
        employeeId,
      }).select("amount reason penaltyType status appliedDate");

      let penaltyList = penalties.map((p) => ({
        type: "penalty",
        amount: p.amount,
        reason: p.reason,
        penaltyType: p.penaltyType,
        status: p.status,
        date: p.appliedDate,
      }));

      // Birlashtirish va sanaga ko'ra tartiblash
      let checklist = [...payments, ...penaltyList];
      checklist.sort((a, b) => new Date(a.date) - new Date(b.date));

      // return checklist;

      return response.success(res, "Oylik hisobot", checklist);
    } catch (error) {
      return response.serverError(
        res,
        "Oylik hisobotini olishda xatolik",
        error
      );
    }
  }
}

module.exports = new SalaryService();
