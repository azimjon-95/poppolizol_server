const { Salecart, Customer } = require("../model/saleCartSchema");
const Expense = require("../model/expenseModel");
const response = require("../utils/response"); // response classini import qilamiz

class customerController {
    // 📊 Mijoz statistikasini olish
    async getCustomerStats(req, res) {
        try {
            const { id } = req.params;

            // Mijozni olish
            const customer = await Customer.findById(id);
            if (!customer) return response.notFound(res, "Mijoz topilmadi");

            // Savdolar
            const sales = await Salecart.find({ customerId: id });

            // Har kuni qancha sotib olganini hisoblash
            const dailyStats = {};
            sales.forEach(sale => {
                sale.deliveredItems.forEach(item => {
                    const date = new Date(item.deliveryDate).toLocaleDateString("uz-UZ");
                    if (!dailyStats[date]) dailyStats[date] = 0;
                    dailyStats[date] += item.totalAmount;
                });
            });

            // Xarajatlar (to‘lovlar)
            const expenses = await Expense.find({ relatedId: id });

            // Jami to‘lovlar
            const totalPayments = expenses.reduce((sum, exp) => sum + exp.amount, 0);

            // Qarzdorlik yoki haqdorlik
            let status = "Balans nol";
            if (customer.balans > 0) status = "Qarzdor";
            if (customer.balans < 0) status = "Haqdor";

            return response.success(res, "Mijoz statistikasi muvaffaqiyatli olindi", {
                customer,
                stats: Object.entries(dailyStats).map(([date, amount]) => ({
                    date,
                    amount,
                })),
                expenses,
                totalPayments,
                balans: customer.balans,
                status,
            });
        } catch (err) {
            console.error(err);
            return response.serverError(res, "Server xatosi");
        }
    }

    // ✏️ Faqat ruxsat berilgan fieldlarni yangilash
    async updateCustomer(req, res) {
        try {
            const { id } = req.params;
            const { name, type, phone, companyAddress, company } = req.body;

            const customer = await Customer.findByIdAndUpdate(
                id,
                { name, type, phone, companyAddress, company },
                { new: true, runValidators: true }
            );

            if (!customer) return response.notFound(res, "Mijoz topilmadi");

            return response.success(res, "Mijoz muvaffaqiyatli yangilandi", { customer });
        } catch (err) {
            console.error(err);
            return response.serverError(res, "Server xatosi");
        }
    }
}

module.exports = new customerController();