const Firm = require("../model/firmModel");
const Income = require("../model/Income");
const moment = require("moment");
const mongoose = require("mongoose");
const response = require("../utils/response"); // Import the response class

class FirmService {
    async processCompanyPayment(req, res) {
        try {
            const { firmId, paymentAmount, paymentMethod, note } = req.body;

            // Validate inputs
            if (!mongoose.Types.ObjectId.isValid(firmId)) {
                return response.error(res, "Noto'g'ri firmId", null);
            }
            if (typeof paymentAmount !== "number" || paymentAmount <= 0) {
                return response.error(res, "Noto'g'ri to'lov summasi", null);
            }
            if (!["naqt", "bank"].includes(paymentMethod)) {
                return response.error(res, "Noto'g'ri to'lov usuli", null);
            }

            // Fetch the firm
            const firm = await Firm.findById(firmId);
            if (!firm) {
                return response.notFound(res, "Firma topilmadi", null);
            }

            // Fetch Income records for the firm
            const incomes = await Income.find({ firmId: firmId }).sort({ date: 1 });
            if (!incomes || incomes.length === 0) {
                // If no Income records, apply payment directly to firm's debt
                let currentDebt = firm.debt || 0;
                currentDebt -= paymentAmount; // Reduce debt (negative means company owes firm)
                await Firm.findByIdAndUpdate(firmId, { debt: currentDebt }, { new: true });
                return response.success(res, "To'lov muvaffaqiyatli qayta ishlandi (hech qanday daromad topilmadi)", {
                    firmId: firm._id,
                    firmName: firm.name,
                    paymentAmount: paymentAmount,
                    newDebt: currentDebt,
                    debtStatus: currentDebt < 0 ? "Kompaniya firmaga qarzdor" : currentDebt > 0 ? "Firma kompaniyaga qarzdor" : "Qarzdorlik yo'q",
                    debtSummary: [],
                });
            }

            // Analyze and distribute payment across Income records
            let remainingPayment = paymentAmount;
            const updatedIncomes = [];
            const debtSummary = [];

            for (let income of incomes) {
                let { initialAmount, remainingAmount, status, debtPayments } = income.debt;

                if (remainingAmount > 0 && remainingPayment > 0) {
                    // Calculate how much of the payment can be applied to this income
                    const paymentToApply = Math.min(remainingAmount, remainingPayment);
                    remainingAmount -= paymentToApply;
                    remainingPayment -= paymentToApply;

                    // Update debt payments
                    debtPayments.push({
                        amount: paymentToApply,
                        paymentDate: Date.now(),
                        paymentMethod: paymentMethod,
                        note: note || "Kompaniya to'lovi",
                    });

                    // Update status
                    status = remainingAmount === 0 ? "fully_paid" : "partially_paid";

                    // Update Income record
                    await Income.findByIdAndUpdate(
                        income._id,
                        {
                            $set: {
                                "debt.remainingAmount": remainingAmount,
                                "debt.status": status,
                                "debt.debtPayments": debtPayments,
                            },
                        },
                        { new: true }
                    );

                    // Add to debt summary
                    debtSummary.push({
                        incomeId: income._id,
                        date: moment(income.date).format("YYYY-MM-DD"),
                        initialAmount: initialAmount,
                        remainingAmount: remainingAmount,
                        totalPaid: initialAmount - remainingAmount,
                        status: status,
                        paymentDetails: debtPayments.map((payment) => ({
                            amount: payment.amount,
                            paymentDate: moment(payment.paymentDate).format("YYYY-MM-DD"),
                            paymentMethod: payment.paymentMethod,
                            note: payment.note || "Yo'q",
                        })),
                    });
                } else {
                    // Include unchanged incomes in summary
                    debtSummary.push({
                        incomeId: income._id,
                        date: moment(income.date).format("YYYY-MM-DD"),
                        initialAmount: initialAmount,
                        remainingAmount: remainingAmount,
                        totalPaid: initialAmount - remainingAmount,
                        status: status,
                        paymentDetails: debtPayments.map((payment) => ({
                            amount: payment.amount,
                            paymentDate: moment(payment.paymentDate).format("YYYY-MM-DD"),
                            paymentMethod: payment.paymentMethod,
                            note: payment.note || "Yo'q",
                        })),
                    });
                }
            }

            // Calculate total remaining debt across all Income records
            const totalDebt = debtSummary.reduce((sum, item) => sum + item.remainingAmount, 0);

            // If there's remaining payment, apply it to firm's debt (overpayment)
            let firmDebt = totalDebt;
            if (remainingPayment > 0) {
                firmDebt -= remainingPayment; // Negative debt means company owes firm
            }

            // Update firm's debt in the database
            await Firm.findByIdAndUpdate(firmId, { debt: firmDebt }, { new: true });

            // Prepare response
            const result = {
                firmId: firm._id,
                firmName: firm.name,
                totalIncomes: incomes.length,
                paymentAmount: paymentAmount,
                remainingPayment: remainingPayment,
                totalDebt: firmDebt,
                debtStatus: firmDebt < 0 ? "Kompaniya firmaga qarzdor" : firmDebt > 0 ? "Firma kompaniyaga qarzdor" : "Qarzdorlik yo'q",
                debtSummary: debtSummary,
            };

            return response.success(res, "To'lov muvaffaqiyatli qayta ishlandi", result);
        } catch (error) {
            return response.serverError(res, `Xatolik yuz berdi: ${error.message}`, null);
        }
    }

    // ✅ Barcha firmalarni olish
    async getAll() {
        try {
            const firms = await Firm.find().sort({ createdAt: -1 });
            return response.success("Barcha firmalar", firms);
        } catch (error) {
            return response.error("Firmalarni olishda xatolik", error.message);
        }
    }

    // ✅ Firmani yangilash
    async update(id, data) {
        try {
            const firm = await Firm.findByIdAndUpdate(id, data, { new: true, runValidators: true });
            if (!firm) return response.error("Firma topilmadi");
            return response.success("Firma muvaffaqiyatli yangilandi", firm);
        } catch (error) {
            return response.error("Firma yangilashda xatolik", error.message);
        }
    }

    // ✅ Firmani o‘chirish
    async delete(id) {
        try {
            const firm = await Firm.findByIdAndDelete(id);
            if (!firm) return response.error("Firma topilmadi");
            return response.success("Firma muvaffaqiyatli o‘chirildi", firm);
        } catch (error) {
            return response.error("Firma o‘chirishda xatolik", error.message);
        }
    }
}

module.exports = new FirmService();