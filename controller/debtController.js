// debtController.js
const Debt = require('../model/debtSchema');
const Income = require("../model/Income");
const response = require("../utils/response");
const Balance = require("../model/balance");
const Expense = require("../model/expenseModel");
const mongoose = require('mongoose');

class DebtController {
    // Yangi qarz yaratish (qarz berish yoki olish)
    static async createDebt(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const debt = await Debt.createDebt(req.body, session);
            await session.commitTransaction();
            return response.created(res, "Qarz muvaffaqiyatli yaratildi", debt);
        } catch (error) {
            await session.abortTransaction();
            return response.error(res, "Qarz yaratishda xatolik: " + error.message);
        } finally {
            session.endSession();
        }
    }

    // Qarzni to‘lash
    static async repayDebt(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { debtId, amount, paymentMethod, note } = req.body;

            // Kirish ma'lumotlarini tekshirish
            if (!debtId || !amount || !paymentMethod) {
                return response.error(res, "Qarz ID, miqdor yoki to‘lov usuli kiritilmadi");
            }

            if (!["naqt", "bank"].includes(paymentMethod)) {
                return response.error(res, `Noto‘g‘ri to‘lov usuli: ${paymentMethod}`);
            }

            if (typeof amount !== "number" || amount <= 0) {
                return response.error(res, "Miqdor musbat son bo‘lishi kerak");
            }

            // Qarzni Debt modelidan izlash
            let debt = await Debt.findById(debtId).session(session);
            if (debt) {
                const updatedDebt = await Debt.repayDebt(debtId, amount, paymentMethod, session);
                // Chiqim yozuvini saqlash (Debt uchun)
                await new Expense({
                    relatedId: debt._id,
                    type: "chiqim",
                    paymentMethod,
                    category: "Qarz to'lovi", // Debt uchun category
                    amount: amount,
                    description: note || `Qarz to‘lovi: ${debtId}`,
                    date: new Date(),
                }).save({ session });

                await session.commitTransaction();
                return response.success(res, "Qarz to‘lovi muvaffaqiyatli amalga oshirildi", updatedDebt);
            }

            // Agar Debt modelida topilmasa, Income modelidan izlash
            const incomes = await Income.find(
                {
                    "firm._id": new mongoose.Types.ObjectId(debtId),
                    "debt.remainingAmount": { $gt: 0 },
                    "debt.status": { $in: ["pending", "partially_paid"] },
                },
                null,
                { session }
            );

            if (!incomes.length) {
                return response.notFound(res, "Ushbu ID uchun faol qarzlar topilmadi");
            }

            let remainingPayment = amount;

            // Har bir qarz bo‘yicha to‘lovlarni amalga oshirish
            for (let income of incomes) {
                if (remainingPayment <= 0) break;

                const debtToPay = Math.min(income.debt.remainingAmount, remainingPayment);
                income.debt.remainingAmount -= debtToPay;
                income.debt.status = income.debt.remainingAmount === 0 ? "fully_paid" : "partially_paid";

                // To‘lov yozuvini qo‘shish
                income.debt.debtPayments.push({
                    amount: debtToPay,
                    paymentMethod,
                    paymentDate: new Date(),
                    note,
                });

                // Chiqim yozuvini saqlash (Income uchun)
                await new Expense({
                    relatedId: income._id,
                    type: "chiqim",
                    paymentMethod,
                    category: "Xomashyo: Ish/chiq. xarajatlari", // Income uchun category
                    amount: debtToPay,
                    description: note || `Firma uchun qarz to‘lovi: ${income.firm.name}`,
                    date: new Date(),
                }).save({ session });

                remainingPayment -= debtToPay;
                await income.save({ session });
            }

            if (remainingPayment > 0) {
                return response.error(res, "To‘lov miqdori umumiy qarzdan oshib ketdi");
            }

            // Balansni yangilash
            await Balance.initializeBalance(session);
            const updatedBalance = await Balance.updateBalance(paymentMethod, "chiqim", amount, session);

            if (!updatedBalance) {
                return response.error(res, `${paymentMethod} balansida yetarli mablag‘ yo‘q`);
            }

            await session.commitTransaction();
            return response.created(res, "To‘lov muvaffaqiyatli amalga oshirildi");
        } catch (error) {
            await session.abortTransaction();
            console.error("To‘lovni amalga oshirishda xatolik:", error);
            return response.serverError(res, "Serverda xatolik yuz berdi", { error: error.message });
        } finally {
            session.endSession();
        }
    }

    // Faol qarzlarni olish
    static async getActiveDebts(req, res) {
        try {
            const { type, status } = req.query;

            // Debt modelidan qarzlarni olish
            const debtModelFilter = {};
            if (type) debtModelFilter.type = type;
            if (status === "active") debtModelFilter.status = "active";
            const debtModelDebts = await Debt.find(debtModelFilter).lean();

            const combinedDebts = [...debtModelDebts].sort(
                (a, b) => a.counterparty.localeCompare(b.counterparty)
            );

            if (!combinedDebts.length) {
                return response.notFound(res, "Hech qanday qarz topilmadi");
            }

            return response.success(res, "Qarzlar muvaffaqiyatli olindi", combinedDebts);
        } catch (error) {
            return response.serverError(res, "Qarzlarni olishda server xatosi", { error: error.message });
        }
    }

    // Qarzlar tarixini olish
    static async getDebtHistory(req, res) {
        try {
            const { type } = req.query;
            const debts = await Debt.getDebtHistory(type);
            return response.success(res, "Qarzlar tarixi muvaffaqiyatli olindi", debts);
        } catch (error) {
            return response.error(res, "Qarzlar tarixini olishda xatolik: " + error.message);
        }
    }
}

module.exports = DebtController;