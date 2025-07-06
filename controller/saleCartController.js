const Salecart = require('../model/saleCartSchema');
const Expense = require('../model/expenseModel');
const Balance = require('../model/balance');
const response = require('../utils/response');

class SaleController {
    // Create a new sale
    async createSale(req, res) {
        try {
            const saleData = req.body;
            if (saleData.payment.totalAmount < saleData.payment.paidAmount) {
                return response.error(res, "To'lov summasi yakuniy summadan oshib ketdi!");
            }
            if (saleData.payment.paidAmount > 0 && !saleData.payment.paymentType) {
                return response.error(res, "To'lov turi kiritilmadi!");
            }

            const sale = new Salecart({
                ...saleData,
                date: new Date().toLocaleDateString('uz-UZ'),
                time: new Date().toLocaleTimeString('uz-UZ'),
                salesperson: req.user.fullname,
                salerId: req.user.id,
            });

            // Update balance if there's a payment
            if (saleData.payment.paidAmount > 0) {
                const balanceField = saleData.payment.paymentType === 'naqt' ? 'cash' : 'bankTransfer';
                await Balance.updateBalance(balanceField, 'kirim', saleData.payment.paidAmount);
            }

            await sale.save();
            return response.created(res, 'Shartnoma muvaffaqiyatli tuzildi va sotuv yakunlandi!', sale);
        } catch (error) {
            console.error('Error creating sale:', error);
            return response.serverError(res, 'Sotuvni saqlashda xatolik yuz berdi!');
        }
    }

    // Get sale by ID
    async getSaleById(req, res) {
        try {
            const sale = await Salecart.findOne({ _id: req.params.id });
            if (!sale) {
                return response.notFound(res, 'Sotuv topilmadi!');
            }
            return response.success(res, 'Success', sale);
        } catch (error) {
            console.error('Error fetching sale:', error);
            return response.serverError(res, 'Sotuvni olishda xatolik yuz berdi!');
        }
    }

    // Update sale
    async updateSale(req, res) {
        try {
            const saleData = req.body;
            const existingSale = await Salecart.findOne({ _id: req.params.id });
            if (!existingSale) {
                return response.notFound(res, 'Sotuv topilmadi!');
            }

            // Check if payment details are being updated
            if (saleData.payment) {
                if (saleData.payment.totalAmount < saleData.payment.paidAmount) {
                    return response.error(res, "To'lov summasi yakuniy summadan oshib ketdi!");
                }
                if (saleData.payment.paidAmount > 0 && !saleData.payment.paymentType) {
                    return response.error(res, "To'lov turi kiritilmadi!");
                }

                // Revert previous payment from balance if it exists
                if (existingSale.payment.paidAmount > 0) {
                    const oldBalanceField = existingSale.payment.paymentType === 'naqt' ? 'cash' : 'bankTransfer';
                    await Balance.updateBalance(oldBalanceField, 'chiqim', existingSale.payment.paidAmount);
                }
                // Add new payment to balance
                if (saleData.payment.paidAmount > 0) {
                    const newBalanceField = saleData.payment.paymentType === 'naqt' ? 'cash' : 'bankTransfer';
                    await Balance.updateBalance(newBalanceField, 'kirim', saleData.payment.paidAmount);
                }
            }

            const sale = await Salecart.findOneAndUpdate(
                { _id: req.params.id },
                { $set: saleData },
                { new: true, runValidators: true }
            );
            return response.success(res, 'Sotuv muvaffaqiyatli yangilandi!', sale);
        } catch (error) {
            console.error('Error updating sale:', error);
            return response.serverError(res, 'Sotuvni yangilashda xatolik yuz berdi!');
        }
    }

    // Delete sale
    async deleteSale(req, res) {
        try {
            const sale = await Salecart.findOne({ _id: req.params.id });
            if (!sale) {
                return response.notFound(res, 'Sotuv topilmadi!');
            }

            // Revert payment from balance if it exists
            if (sale.payment.paidAmount > 0) {
                const balanceField = sale.payment.paymentType === 'naqt' ? 'cash' : 'bankTransfer';
                await Balance.updateBalance(balanceField, 'chiqim', sale.payment.paidAmount);
            }

            await Salecart.deleteOne({ _id: req.params.id });
            await Expense.deleteMany({ relatedId: req.params.id });
            return response.success(res, 'Sotuv muvaffaqiyatli o‘chirildi!');
        } catch (error) {
            console.error('Error deleting sale:', error);
            return response.serverError(res, 'Sotuvni o‘chirishda xatolik yuz berdi!');
        }
    }

    // Mark sale as delivered
    async markAsDelivered(req, res) {
        try {
            const sale = await Salecart.findOneAndUpdate(
                { _id: req.params.id },
                {
                    $set: {
                        isDelivered: true,
                        deliveryDate: new Date()
                    }
                },
                { new: true }
            );
            if (!sale) {
                return response.notFound(res, 'Sotuv topilmadi!');
            }
            return response.success(res, 'Yuk muvaffaqiyatli yetkazib berildi deb belgilandi!', sale);
        } catch (error) {
            console.error('Error marking delivery:', error);
            return response.serverError(res, 'Yuk holatini yangilashda xatolik yuz berdi!');
        }
    }

    // Process debt payment
    async payDebt(req, res) {
        try {
            const { amount, description, paymentType } = req.body;
            if (!amount || amount <= 0) {
                return response.error(res, 'To‘lov summasi noto‘g‘ri kiritildi!');
            }
            if (!paymentType || !['naqt', 'bank'].includes(paymentType)) {
                return response.error(res, 'To‘lov turi noto‘g‘ri kiritildi!');
            }

            const sale = await Salecart.findOne({ _id: req.params.id });
            if (!sale) {
                return response.notFound(res, 'Sotuv topilmadi!');
            }

            const newPaidAmount = sale.payment.paidAmount + amount;
            if (newPaidAmount > sale.payment.totalAmount) {
                return response.error(res, 'To‘lov summasi yakuniy summadan oshib ketdi!');
            }

            // Update balance for debt payment
            const balanceField = paymentType === 'naqt' ? 'cash' : 'bankTransfer';
            await Balance.updateBalance(balanceField, 'kirim', amount);

            const updatedSale = await Salecart.findOneAndUpdate(
                { _id: req.params.id },
                {
                    $set: {
                        'payment.paidAmount': newPaidAmount,
                        'payment.debt': sale.payment.totalAmount - newPaidAmount,
                        'payment.status': newPaidAmount >= sale.payment.totalAmount ? 'paid' : 'partial',
                    },
                    $push: {
                        'payment.paymentHistory': {
                            amount,
                            date: new Date(),
                            description: description || '',
                            paidBy: req.user.fullname,
                            paymentType,
                        },
                    },
                },
                { new: true, runValidators: true }
            );

            // Create expense record for debt payment
            const expense = new Expense({
                relatedId: sale._id.toString(),
                type: 'kirim',
                paymentMethod: paymentType,
                category: 'Mijoz tulovi',
                amount,
                description: description || 'Qarz to‘lovi',
                date: new Date(),
            });
            await expense.save();

            return response.success(res, 'Qarz to‘lovi muvaffaqiyatli amalga oshirildi!', updatedSale);
        } catch (error) {
            console.error('Error processing debt payment:', error);
            return response.serverError(res, 'Qarz to‘lovida xatolik yuz berdi!');
        }
    }
}

module.exports = new SaleController();

