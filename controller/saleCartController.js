const { Salecart, Customer } = require('../model/saleCartSchema');
const Expense = require('../model/expenseModel');
const Employee = require('../model/adminModel');
const Plan = require('../model/planSalerModel');
const Balance = require('../model/balance');
const FinishedProduct = require('../model/finishedProductModel');
const response = require('../utils/response');
const mongoose = require('mongoose');
const moment = require('moment');

class SaleController {
    // Create a new sale
    async createSale(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { customer: customerData, salerId, items, payment } = req.body;

            // Validate input
            if (!customerData || !salerId || !items || !payment) {
                await session.abortTransaction();
                return response.error(res, "Barcha maydonlar to'ldirilishi shart");
            }

            if (!customerData.name) {
                await session.abortTransaction();
                return response.error(res, "Mijoz ismi kiritilishi shart");
            }

            if (payment.totalAmount < payment.paidAmount) {
                await session.abortTransaction();
                return response.error(res, "To'lov summasi yakuniy summadan oshib ketdi!");
            }

            if (payment.paidAmount > 0 && !payment.paymentType) {
                await session.abortTransaction();
                return response.error(res, "To'lov turi kiritilmadi!");
            }

            // Verify saler exists
            const employee = await Employee.findById(salerId).session(session);
            if (!employee) {
                await session.abortTransaction();
                return response.notFound(res, "Sotuvchi topilmadi");
            }

            // Find or create customer
            let customer = await Customer.findOne({
                $or: [
                    { phone: customerData.phone || '' },
                    { name: customerData.name, type: customerData.type || 'individual' }
                ]
            }).session(session);

            if (!customer) {
                customer = new Customer({
                    name: customerData.name,
                    phone: customerData.phone || '',
                    type: customerData.type || 'individual',
                    companyAddress: customerData.type === 'company' ? customerData.companyAddress : undefined,
                });
                await customer.save({ session });
            }

            // Get current month for plan based on current date
            const currentDate = new Date();
            const month = `${currentDate.getFullYear()}.${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

            // Find plan for current month
            const plan = await Plan.findOne({
                employeeId: salerId,
                month
            }).session(session);

            if (!plan) {
                await session.abortTransaction();
                return response.notFound(res, `Sotuvchi uchun ${month} oyida plan topilmadi`);
            }

            // Validate and update product quantities
            for (const item of items) {
                const product = await FinishedProduct.findById(item._id).session(session);
                if (!product) {
                    await session.abortTransaction();
                    return response.notFound(res, `Maxsulot topilmadi: ${item.productName}`);
                }
                if (product.quantity < item.quantity) {
                    await session.abortTransaction();
                    return response.error(res, `Maxsulot ${item.productName} uchun yetarli miqdor yo'q`);
                }
                product.quantity -= item.quantity;
                await product.save({ session });
            }

            // Create new sale
            const newSale = new Salecart({
                customerId: customer._id,
                salerId,
                items,
                payment,
                salesperson: `${employee.firstName} ${employee.lastName}`,
                date: new Date().toLocaleDateString('uz-UZ'),
                time: new Date().toLocaleTimeString('uz-UZ'),
                transport: req.body.transport || '',
                isContract: req.body.isContract ?? true,
                deliveryDate: req.body.deliveryDate || null
            });

            // Update balance if there's a payment
            if (payment.paidAmount > 0) {
                const balanceField = payment.paymentType === 'naqt' ? 'naqt' : 'bank';
                await Balance.updateBalance(balanceField, 'kirim', payment.paidAmount, { session });

                // Update plan based on paid amount
                plan.achievedAmount += payment.paidAmount;
                plan.progress = Math.min((plan.achievedAmount / plan.targetAmount) * 100, 100);
                await plan.save({ session });
            }

            // Save sale
            const savedSale = await newSale.save({ session });

            // Add sale to plan's sales array
            plan.sales.push(savedSale._id);
            await plan.save({ session });

            await session.commitTransaction();

            // Populate data in response
            const populatedSale = await Salecart.findById(savedSale._id)
                .populate('customerId', 'name type phone companyAddress')
                .populate('salerId', 'firstName lastName')
                .lean();

            return response.created(res, "Shartnoma muvaffaqiyatli tuzildi!", populatedSale);
        } catch (error) {
            await session.abortTransaction();
            return response.serverError(res, "Sotuvni saqlashda xatolik!", error.message);
        } finally {
            session.endSession();
        }
    }

    // Get sale by ID
    async getSaleById(req, res) {
        try {
            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return response.error(res, 'Noto‘g‘ri sotuv ID formati!');
            }

            const sale = await Salecart.findById(id)
                .populate('customerId', 'name type phone companyAddress')
                .populate('salerId', 'firstName lastName')
                .lean();

            if (!sale) {
                return response.notFound(res, 'Sotuv topilmadi!');
            }
            return response.success(res, 'Muvaffaqiyatli', sale);
        } catch (error) {
            return response.serverError(res, 'Sotuvni olishda xatolik!', error.message);
        }
    }

    // Update sale
    async updateSale(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const saleData = req.body;
            const existingSale = await Salecart.findById(req.params.id).session(session);
            if (!existingSale) {
                await session.abortTransaction();
                return response.notFound(res, 'Sotuv topilmadi!');
            }

            // Calculate original sale amount
            const originalSaleAmount = existingSale.items.reduce((sum, item) => sum + (item.discountedPrice * item.quantity), 0);

            // Get current month for plan
            const currentDate = new Date(existingSale.createdAt); // Use sale's creation date
            const month = `${currentDate.getFullYear()}.${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

            // Find plan for current month
            const plan = await Plan.findOne({
                employeeId: existingSale.salerId,
                month
            }).session(session);

            if (!plan) {
                await session.abortTransaction();
                return response.notFound(res, `Sotuvchi uchun ${month} oyida plan topilmadi`);
            }

            // Handle customer update if provided
            if (saleData.customer) {
                let customer = await Customer.findOne({
                    $or: [
                        { phone: saleData.customer.phone || '' },
                        { name: saleData.customer.name, type: saleData.customer.type || 'individual' }
                    ]
                }).session(session);

                if (!customer) {
                    customer = new Customer({
                        name: saleData.customer.name,
                        phone: saleData.customer.phone || '',
                        type: saleData.customer.type || 'individual',
                        companyAddress: saleData.customer.type === 'company' ? saleData.customer.companyAddress : undefined,
                    });
                    await customer.save({ session });
                }
                saleData.customerId = customer._id;
                delete saleData.customer;
            }

            // Handle items update
            let newSaleAmount = originalSaleAmount;
            if (saleData.items) {
                // Restore original product quantities
                for (const item of existingSale.items) {
                    const product = await FinishedProduct.findById(item._id).session(session);
                    if (product) {
                        product.quantity += item.quantity;
                        await product.save({ session });
                    }
                }

                // Validate and deduct new quantities
                for (const item of saleData.items) {
                    const product = await FinishedProduct.findById(item._id).session(session);
                    if (!product) {
                        await session.abortTransaction();
                        return response.notFound(res, `Maxsulot topilmadi: ${item.productName}`);
                    }
                    if (product.quantity < item.quantity) {
                        await session.abortTransaction();
                        return response.error(res, `Maxsulot ${item.productName} uchun yetarli miqdor yo'q`);
                    }
                    product.quantity -= item.quantity;
                    await product.save({ session });
                }

                // Calculate new sale amount
                newSaleAmount = saleData.items.reduce((sum, item) => sum + (item.discountedPrice * item.quantity), 0);
            }

            // Handle payment update
            if (saleData.payment) {
                if (saleData.payment.totalAmount < saleData.payment.paidAmount) {
                    await session.abortTransaction();
                    return response.error(res, "To'lov summasi yakuniy summadan oshib ketdi!");
                }
                if (saleData.payment.paidAmount > 0 && !saleData.payment.paymentType) {
                    await session.abortTransaction();
                    return response.error(res, "To'lov turi kiritilmadi!");
                }

                if (existingSale.payment.paidAmount > 0) {
                    const oldBalanceField = existingSale.payment.paymentType === 'naqt' ? 'naqt' : 'bank';
                    await Balance.updateBalance(oldBalanceField, 'chiqim', existingSale.payment.paidAmount, { session });
                }
                if (saleData.payment.paidAmount > 0) {
                    const newBalanceField = saleData.payment.paymentType === 'naqt' ? 'naqt' : 'bank';
                    await Balance.updateBalance(newBalanceField, 'kirim', saleData.payment.paidAmount, { session });
                }
            }

            // Update plan
            const amountDifference = newSaleAmount - originalSaleAmount;
            plan.achievedAmount = Math.max(0, plan.achievedAmount + amountDifference);
            plan.progress = plan.targetAmount > 0 ? Math.min((plan.achievedAmount / plan.targetAmount) * 100, 100) : 0;
            await plan.save({ session });

            // Update sale
            const sale = await Salecart.findByIdAndUpdate(
                req.params.id,
                { $set: saleData },
                { new: true, runValidators: true }
            ).session(session);

            await session.commitTransaction();
            const populatedSale = await Salecart.findById(sale._id)
                .populate('customerId', 'name type phone companyAddress')
                .populate('salerId', 'firstName lastName')
                .lean();

            return response.success(res, 'Sotuv muvaffaqiyatli yangilandi!', populatedSale);
        } catch (error) {
            await session.abortTransaction();
            return response.serverError(res, 'Sotuvni yangilashda xatolik!', error.message);
        } finally {
            session.endSession();
        }
    }

    // Delete sale
    async deleteSale(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const sale = await Salecart.findById(req.params.id).session(session);
            if (!sale) {
                await session.abortTransaction();
                return response.notFound(res, 'Sotuv topilmadi!');
            }

            // Calculate total sale amount
            const totalSaleAmount = sale.items.reduce((sum, item) => sum + (item.discountedPrice * item.quantity), 0);

            // Get current month for plan
            const currentDate = new Date(sale.createdAt); // Use sale's creation date to ensure correct month
            const month = `${currentDate.getFullYear()}.${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

            // Find plan for current month
            const plan = await Plan.findOne({
                employeeId: sale.salerId,
                month
            }).session(session);

            if (!plan) {
                await session.abortTransaction();
                return response.notFound(res, `Sotuvchi uchun ${month} oyida plan topilmadi`);
            }

            // Remove sale from plan and update achievedAmount
            plan.sales = plan.sales.filter(saleId => saleId.toString() !== sale._id.toString());
            plan.achievedAmount = Math.max(0, plan.achievedAmount - totalSaleAmount);
            plan.progress = plan.targetAmount > 0 ? Math.min((plan.achievedAmount / plan.targetAmount) * 100, 100) : 0;
            await plan.save({ session });

            // Restore product quantities
            for (const item of sale.items) {
                const product = await FinishedProduct.findById(item._id).session(session);
                if (product) {
                    product.quantity += item.quantity;
                    await product.save({ session });
                }
            }

            // Update balance if there was a payment
            if (sale.payment.paidAmount > 0) {
                const balanceField = sale.payment.paymentType === 'naqt' ? 'naqt' : 'bank';
                await Balance.updateBalance(balanceField, 'chiqim', sale.payment.paidAmount, { session });
            }

            // Delete sale and related expenses
            await Salecart.deleteOne({ _id: req.params.id }).session(session);
            await Expense.deleteMany({ relatedId: req.params.id }).session(session);

            await session.commitTransaction();
            return response.success(res, 'Sotuv muvaffaqiyatli o‘chirildi!');
        } catch (error) {
            await session.abortTransaction();
            return response.serverError(res, 'Sotuvni o‘chirishda xatolik!', error.message);
        } finally {
            session.endSession();
        }
    }

    // Process debt payment
    async payDebt(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { amount, description, paymentType } = req.body;

            if (!amount || amount <= 0) {
                await session.abortTransaction();
                return response.error(res, 'To‘lov summasi noto‘g‘ri kiritildi!');
            }
            if (!['naqt', 'bank'].includes(paymentType)) {
                await session.abortTransaction();
                return response.error(res, 'To‘lov turi noto‘g‘ri kiritildi!');
            }

            const sale = await Salecart.findById(req.params.id).session(session);
            if (!sale) {
                await session.abortTransaction();
                return response.notFound(res, 'Sotuv topilmadi!');
            }

            const newPaidAmount = sale.payment.paidAmount + amount;
            if (newPaidAmount > sale.payment.totalAmount) {
                await session.abortTransaction();
                return response.error(res, 'To‘lov summasi yakuniy summadan oshib ketdi!');
            }

            // Get the month for the plan based on the sale's createdAt date
            const currentDate = new Date(sale.createdAt);
            const month = `${currentDate.getFullYear()}.${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

            // Find plan for the sale's month
            const plan = await Plan.findOne({
                employeeId: sale.salerId,
                month
            }).session(session);

            if (!plan) {
                await session.abortTransaction();
                return response.notFound(res, `Sotuvchi uchun ${month} oyida plan topilmadi`);
            }

            // Update balance
            const balanceField = paymentType === 'naqt' ? 'naqt' : 'bank';
            await Balance.updateBalance(balanceField, 'kirim', amount, { session });

            // Update sale payment details
            const updatedSale = await Salecart.findByIdAndUpdate(
                req.params.id,
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
                            paidBy: sale.salesperson,
                            paymentType,
                        },
                    },
                },
                { new: true, runValidators: true }
            ).session(session);

            // Update plan based on payment amount
            plan.achievedAmount += amount;
            plan.progress = Math.min((plan.achievedAmount / plan.targetAmount) * 100, 100);
            await plan.save({ session });

            // Create expense record
            const expense = new Expense({
                relatedId: sale._id.toString(),
                type: 'kirim',
                paymentMethod: paymentType,
                category: 'Mijoz tulovi',
                amount,
                description: description || 'Qarz to‘lovi',
                date: new Date(),
            });
            await expense.save({ session });

            await session.commitTransaction();
            const populatedSale = await Salecart.findById(updatedSale._id)
                .populate('customerId', 'name type phone companyAddress')
                .populate('salerId', 'firstName lastName')
                .lean();

            return response.success(res, 'Qarz to‘lovi muvaffaqiyatli!', populatedSale);
        } catch (error) {
            await session.abortTransaction();
            return response.serverError(res, 'Qarz to‘lovida xatolik!', error.message);
        } finally {
            session.endSession();
        }
    }

    //get customers all
    async getCompanys(req, res) {
        try {
            const customers = await Customer.find();
            console.log(customers);
            return response.success(res, 'Mijozlar muvaffaqiyatli o‘qildi!', customers);
        } catch (error) {
            return response.serverError(res, 'Mijozlarni o‘qishda xatolik!', error.message);
        }
    }

    // Get sales filtered by customer and status
    async getCustomerSales(req, res) {
        try {
            const { customerId, status, month } = req.query;

            if (!mongoose.Types.ObjectId.isValid(customerId)) {
                return response.error(res, 'Noto‘g‘ri mijoz ID formati!');
            }

            const query = { customerId };

            if (status) {
                if (status === 'active') {
                    query['payment.isActive'] = true;
                } else if (status === 'completed') {
                    query['payment.isActive'] = false;
                }
            }

            if (month && /^\d{2}\.\d{4}$/.test(month)) {
                const startDate = moment(month, 'MM.YYYY').startOf('month').toDate();
                const endDate = moment(month, 'MM.YYYY').endOf('month').toDate();
                query.createdAt = { $gte: startDate, $lte: endDate };
            }

            const sales = await Salecart.find(query)
                .populate('customerId', 'name type phone companyAddress')
                .populate('salerId', 'firstName lastName')
                .sort({ createdAt: -1 })
                .lean();

            if (!sales.length) {
                return response.success(res, 'Sotuvlar topilmadi', []);
            }

            return response.success(res, 'Mijoz sotuvlari ro‘yxati', sales);
        } catch (error) {
            return response.serverError(res, 'Sotuvlarni olishda xatolik!', error.message);
        }
    }

    // Get customer sales history (completed sales)
    async getCustomerCompletedSales(req, res) {
        try {
            const { customerId } = req.params;

            if (!mongoose.Types.ObjectId.isValid(customerId)) {
                return response.error(res, 'Noto‘g‘ri mijoz ID formati!');
            }

            const sales = await Salecart.find({
                customerId,
                'payment.isActive': false
            })
                .populate('customerId', 'name type phone companyAddress')
                .populate('salerId', 'firstName lastName')
                .sort({ createdAt: -1 })
                .lean();

            if (!sales.length) {
                return response.success(res, 'Yakunlangan sotuvlar topilmadi', []);
            }

            return response.success(res, 'Yakunlangan sotuvlar ro‘yxati', sales);
        } catch (error) {
            return response.serverError(res, 'Yakunlangan sotuvlarni olishda xatolik!', error.message);
        }
    }

    // Get customer active sales (unpaid/partially paid)
    async getCustomerActiveSales(req, res) {
        try {
            const { customerId } = req.params;

            if (!mongoose.Types.ObjectId.isValid(customerId)) {
                return response.error(res, 'Noto‘g‘ri mijoz ID formati!');
            }

            const sales = await Salecart.find({
                customerId,
                'payment.isActive': true
            })
                .populate('customerId', 'name type phone companyAddress')
                .populate('salerId', 'firstName lastName')
                .sort({ createdAt: -1 })
                .lean();

            if (!sales.length) {
                return response.success(res, 'Faol sotuvlar topilmadi', []);
            }

            return response.success(res, 'Faol sotuvlar ro‘yxati', sales);
        } catch (error) {
            return response.serverError(res, 'Faol sotuvlarni olishda xatolik!', error.message);
        }
    }

    async getFilteredSales(req, res) {
        try {
            const { month } = req.query;

            if (!month || !/^\d{2}\.\d{4}$/.test(month)) {
                return response.error(res, "Noto‘g‘ri yoki yetishmayotgan 'month' parametri (MM.YYYY)");
            }

            const startDate = moment(month, 'MM.YYYY').startOf('month').toDate();
            const endDate = moment(month, 'MM.YYYY').endOf('month').toDate();

            const sales = await Salecart.find({
                createdAt: { $gte: startDate, $lte: endDate }
            })
                .populate('customerId') // Populate the customerId field with Customer data
                .sort({ createdAt: -1 });

            if (!sales.length) {
                return response.success(res, "Ko‘rsatilgan oyning faol savdolari topilmadi", []);
            }

            return response.success(res, "Tanlangan oyning faol savdolar ro‘yxati", sales);

        } catch (err) {
            console.error('Error in getFilteredSales:', err);
            return response.serverError(res, "Server xatosi", err.message);
        }
    }

    // Process product returns
    async returnItems(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { items, totalRefund, reason, paymentType, description } = req.body;

            if (!items || !items.length || totalRefund <= 0) {
                await session.abortTransaction();
                return response.error(res, 'Qaytarish uchun mahsulotlar yoki to‘g‘ri summa kiritilmadi!');
            }
            if (!reason) {
                await session.abortTransaction();
                return response.error(res, 'Qaytarish sababi kiritilmadi!');
            }
            if (!['naqt', 'bank'].includes(paymentType)) {
                await session.abortTransaction();
                return response.error(res, 'To‘lov turi noto‘g‘ri kiritildi!');
            }

            const sale = await Salecart.findById(req.params.id).session(session);
            if (!sale) {
                await session.abortTransaction();
                return response.notFound(res, 'Sotuv topilmadi!');
            }

            for (const returnItem of items) {
                const originalProduct = await FinishedProduct.findById(returnItem.productId).session(session);
                if (!originalProduct) {
                    await session.abortTransaction();
                    return response.notFound(res, `Mahsulot topilmadi: ${returnItem.productName}`);
                }
                const originalItem = sale.items.find(item => item._id.toString() === returnItem.productId);
                if (!originalItem || returnItem.quantity > originalItem.quantity) {
                    await session.abortTransaction();
                    return response.error(res, `Qaytarish miqdori ${returnItem.productName} uchun asl sotuv miqdoridan oshib ketdi!`);
                }
                const newProduct = new FinishedProduct({
                    productName: returnItem.productName,
                    category: returnItem.category,
                    quantity: returnItem.quantity,
                    marketType: originalProduct.marketType,
                    size: originalProduct.size,
                    productionDate: originalProduct.productionDate,
                    productionCost: originalProduct.productionCost,
                    sellingPrice: originalProduct.sellingPrice,
                    isReturned: true,
                    returnInfo: {
                        returnReason: reason,
                        returnDescription: description || '',
                        returnDate: new Date(),
                    },
                });
                await newProduct.save({ session });
            }

            const balanceField = paymentType === 'naqt' ? 'naqt' : 'bank';
            await Balance.updateBalance(balanceField, 'chiqim', totalRefund, { session });

            const expense = new Expense({
                relatedId: sale._id.toString(),
                type: 'chiqim',
                paymentMethod: paymentType,
                category: 'Mahsulot qaytarish',
                amount: totalRefund,
                description: reason,
                date: new Date(),
            });
            await expense.save({ session });

            const newPaidAmount = sale.payment.paidAmount - totalRefund;
            const updatedSale = await Salecart.findByIdAndUpdate(
                req.params.id,
                {
                    $set: {
                        'payment.paidAmount': Math.max(0, newPaidAmount),
                        'payment.debt': sale.payment.totalAmount - Math.max(0, newPaidAmount),
                        'payment.status': newPaidAmount >= sale.payment.totalAmount ? 'paid' : 'partial',
                    },
                    $push: {
                        'payment.paymentHistory': {
                            amount: -totalRefund,
                            date: new Date(),
                            description: `Qaytarish: ${reason}`,
                            paidBy: sale.salesperson,
                            paymentType,
                        },
                    },
                },
                { new: true, runValidators: true }
            ).session(session);

            await session.commitTransaction();
            const populatedSale = await Salecart.findById(updatedSale._id)
                .populate('customerId', 'name type phone companyAddress')
                .populate('salerId', 'firstName lastName')
                .lean();

            return response.success(res, 'Mahsulot qaytarish muvaffaqiyatli!', populatedSale);
        } catch (error) {
            await session.abortTransaction();
            return response.serverError(res, 'Mahsulot qaytarishda xatolik!', error.message);
        } finally {
            session.endSession();
        }
    }
}

module.exports = new SaleController();
