// materialService.js
const Material = require("../model/wherehouseModel");
const Firm = require("../model/firmModel");
const Income = require("../model/Income");
const Balance = require("../model/balance");
const Expense = require("../model/expenseModel");
const FinishedProduct = require('../model/finishedProductModel');
const moment = require("moment")
const mongoose = require("mongoose");

const response = require("../utils/response");

class MaterialService {
    async handleNewIncome(req, res) {
        try {
            const {
                firm: firmData,
                materials: materialsList,
                price,
                paymentType,
                vatPercentage,
                totalTransportCost,
                totalWithVat,
                totalWithoutVat,
                totalWorkerCost,
                vatAmount,
                workerPayments,
                debtPayment
            } = req.body;

            // Validation
            if (!firmData?.name || !Array.isArray(materialsList) || materialsList.length === 0) {
                return response.error(res, "Firma va materiallar to‘liq kiritilishi kerak");
            }

            // Prepare firm data
            const firm = {
                name: firmData.name,
                phone: firmData.phone || null,
                address: firmData.address || null,
            };

            // Prepare materials and calculate total
            const incomeMaterials = [];
            let calculatedTotalWithoutVat = 0;
            const materialUpdates = [];
            const newMaterials = [];

            for (const item of materialsList) {
                if (!item.name || !item.quantity || !item.price || !item.currency || !item.unit) {
                    return response.error(res, "Material ma'lumotlari to‘liq emas");
                }

                calculatedTotalWithoutVat += item.price * item.quantity;

                const materialData = {
                    category: item.category || null,
                    currency: item.currency,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    transportCostPerUnit: item.transportCostPerUnit || 0,
                    unit: item.unit,
                    workerCostPerUnit: item.workerCostPerUnit || 0,
                };

                // Check for existing material
                const existingMaterial = await Material.findOne({ name: item.name }).lean();
                if (existingMaterial) {
                    const totalQty = existingMaterial.quantity + item.quantity;
                    const newPrice = Math.max(existingMaterial.avgPrice, item.price); // Always take the higher price

                    materialUpdates.push({
                        updateOne: {
                            filter: { _id: existingMaterial._id },
                            update: { quantity: totalQty, avgPrice: newPrice },
                        },
                    });
                    materialData.material = existingMaterial._id;
                } else {
                    newMaterials.push({
                        name: item.name,
                        unit: item.unit,
                        quantity: item.quantity,
                        price: item.price,
                        currency: item.currency,
                        category: item.category || null,
                        avgPrice: item.price
                    });
                    materialData.material = null; // Will be updated after insertion
                }

                incomeMaterials.push(materialData);
            }

            // Execute bulk operations for materials
            if (materialUpdates.length > 0) {
                await Material.bulkWrite(materialUpdates);
            }
            if (newMaterials.length > 0) {
                const createdMaterials = await Material.insertMany(newMaterials);
                // Update incomeMaterials with new material IDs
                let newMaterialIndex = 0;
                incomeMaterials.forEach((im) => {
                    if (!im.material) {
                        im.material = createdMaterials[newMaterialIndex]._id;
                        newMaterialIndex++;
                    }
                });
            }

            // Validate workerPayments
            if (workerPayments && Array.isArray(workerPayments)) {
                for (const payment of workerPayments) {
                    if (!payment.workerId || !payment.payment) {
                        return response.error(res, "Ishchi to‘lovlari ma'lumotlari to‘liq emas");
                    }
                }
            }

            // Calculate financials
            const finalVatPercentage = vatPercentage || 0;
            const finalVatAmount = vatAmount || (calculatedTotalWithoutVat * finalVatPercentage) / 100;
            const finalTotalWithVat = totalWithVat || calculatedTotalWithoutVat + finalVatAmount;
            const finalTotalWithoutVat = totalWithoutVat || calculatedTotalWithoutVat;
            const finalTotalTransportCost = totalTransportCost || materialsList.reduce((sum, item) => sum + (item.transportCostPerUnit || 0) * item.quantity, 0);
            const finalTotalWorkerCost = totalWorkerCost || materialsList.reduce((sum, item) => sum + (item.workerCostPerUnit || 0) * item.quantity, 0);
            const finalPrice = price || 0;

            // Initialize debt
            const debt = {
                initialAmount: finalTotalWithVat,
                remainingAmount: finalTotalWithVat - finalPrice,
                status: finalTotalWithVat - finalPrice <= 0 ? 'fully_paid' : finalPrice > 0 ? 'partially_paid' : 'pending',
                debtPayments: []
            };

            // Handle initial debt payment
            if (debtPayment && debtPayment.amount && debtPayment.paymentMethod) {
                if (!['naqt', 'bank'].includes(debtPayment.paymentMethod)) {
                    return response.error(res, "Noto‘g‘ri to‘lov usuli");
                }
                if (debtPayment.amount > debt.remainingAmount) {
                    return response.error(res, "To‘lov summasi qolgan qarzdan oshib ketdi");
                }
                debt.debtPayments.push({
                    amount: debtPayment.amount,
                    paymentMethod: debtPayment.paymentMethod,
                    note: debtPayment.note || '',
                    paymentDate: new Date()
                });
                debt.remainingAmount -= debtPayment.amount;
                debt.status = debt.remainingAmount === 0 ? 'fully_paid' : 'partially_paid';
            }

            // Create single income record
            const income = await Income.create({
                firm,
                materials: incomeMaterials,
                price: finalPrice,
                paymentType: paymentType || null,
                vatPercentage: finalVatPercentage,
                totalTransportCost: finalTotalTransportCost,
                totalWithVat: finalTotalWithVat,
                totalWithoutVat: finalTotalWithoutVat,
                totalWorkerCost: finalTotalWorkerCost,
                vatAmount: finalVatAmount,
                workerPayments: workerPayments || [],
                debt,
                date: new Date(),
            });

            return response.created(res, "Kirim muvaffaqiyatli qo‘shildi", income);
        } catch (error) {
            console.error("handleNewIncome xatolik:", error);
            return response.serverError(res, "Serverda xatolik yuz berdi", { error: error.message });
        }
    }



    async createFirm(req, res) {
        try {
            const existingFirm = await Firm.findOne({ name: req.body.name });
            if (existingFirm) {
                return response.error(res, "Firma allaqachon mavjud");
            }

            const firm = await Firm.create(req.body);
            return response.created(res, "Firma muvaffaqiyatli qo‘shildi", firm);
        } catch (error) {
            return response.serverError(res, "Serverda xatolik yuz berdi", { error: error.message });
        }
    }
    // Get Firms
    async getFirms(req, res) {
        try {
            const firms = await Firm.find();
            return response.success(res, "Firmalar muvaffaqiyatli o'qildi", firms);
        } catch (error) {
            return response.serverError(res, "Serverda xatolik yuz berdi", { error: error.message });
        }
    }

    //Income
    async getIncomes(req, res) {
        try {
            const { month } = req.query;
            if (!month || !/^\d{2}\.\d{4}$/.test(month)) {
                return response.error(res, "Noto‘g‘ri yoki yetishmayotgan 'month' parametri (MM.YYYY)");
            }

            const startDate = moment(month, 'MM.YYYY').startOf('month').toDate();
            const endDate = moment(month, 'MM.YYYY').endOf('month').toDate();


            const incomes = await Income.find({
                createdAt: { $gte: startDate, $lte: endDate }
            })
                .populate('workerPayments.workerId')
                .sort({ createdAt: -1 });
            // .populate('materials.material')

            return response.success(res, "Kirimlar muvaffaqiyatli o'qildi", incomes);
        } catch (error) {
            return response.serverError(res, "Serverda xatolik yuz berdi", { error: error.message });
        }
    }


    // Tuzatilgan payDebtIncom funksiyasi - Alternativ yondashuv
    async payDebtIncom(req, res) {
        const session = await mongoose.startSession();

        try {
            // Manual transaction management
            await session.startTransaction();

            const transactionResult = await (async () => {
                const { incomeId, debtPayment } = req.body;

                // Validate input
                if (!incomeId || !debtPayment?.amount || !debtPayment?.paymentMethod) {
                    throw new Error('Barcha majburiy maydonlar (incomeId, amount, paymentMethod) to\'ldirilishi kerak');
                }

                // Validate payment method
                const validPaymentMethods = ['naqt', 'bank'];
                if (!validPaymentMethods.includes(debtPayment.paymentMethod)) {
                    throw new Error(`Noto'g'ri to'lov usuli: ${debtPayment.paymentMethod}`);
                }

                // Fetch income first
                const income = await Income.findById(incomeId).session(session);
                if (!income) {
                    throw new Error('Kirim topilmadi');
                }

                // Check debt and remaining amount
                const remainingDebt = income.debt?.remainingAmount ?? (income.totalWithVat || income.totalWithoutVat);
                if (!income.debt || remainingDebt <= 0) {
                    throw new Error('Qarz mavjud emas yoki u allaqachon to\'liq to\'langan');
                }

                if (debtPayment.amount > remainingDebt) {
                    throw new Error(`To'lov summasi (${debtPayment.amount}) qoldiq qarzdan (${remainingDebt}) oshib ketdi`);
                }

                // Fetch balance after income validation
                const balance = await Balance.findOne().session(session);
                if (!balance || balance[debtPayment.paymentMethod] < debtPayment.amount) {
                    throw new Error(`${debtPayment.paymentMethod}da yetarli mablag' yo'q`);
                }

                // Create debt payment record
                const newDebtPayment = {
                    amount: debtPayment.amount,
                    paymentMethod: debtPayment.paymentMethod,
                    note: debtPayment.note || '',
                    paymentDate: new Date(),
                };

                // Update income debt
                if (!income.debt.initialAmount) {
                    income.debt.initialAmount = income.totalWithVat || income.totalWithoutVat;
                }
                income.debt.debtPayments = income.debt.debtPayments || [];
                income.debt.debtPayments.push(newDebtPayment);
                income.debt.remainingAmount = remainingDebt - debtPayment.amount;
                income.debt.status = income.debt.remainingAmount === 0 ? 'fully_paid' : 'partially_paid';
                income.price = (income.price || 0) + debtPayment.amount;

                // Create expense record
                const expense = new Expense({
                    relatedId: incomeId,
                    type: 'chiqim',
                    paymentMethod: debtPayment.paymentMethod,
                    category: 'Qarz to\'lovi',
                    amount: debtPayment.amount,
                    description: `Kirim material uchun qarz to'lovi - ${income.firm?.name || 'Noma\'lum firma'}`,
                    date: new Date(),
                });

                // Update balance
                await Balance.updateBalance(debtPayment.paymentMethod, 'chiqim', debtPayment.amount, session);

                // Save all changes within the transaction
                await income.save({ session });
                await expense.save({ session });

                // Return the data for response
                return {
                    income,
                    expense,
                    paymentDetails: newDebtPayment,
                };
            })();

            // Commit transaction if all operations succeeded
            await session.commitTransaction();

            // If we reach here, transaction was successful
            return response.success(res, 'Qarz to\'lovi muvaffaqiyatli amalga oshirildi', transactionResult);

        } catch (error) {
            // Abort transaction on error
            await session.abortTransaction();
            console.error('payDebtIncom xatosi:', error);
            return response.serverError(res, 'Serverda xatolik yuz berdi', { error: error.message });
        } finally {
            await session.endSession();
        }
    }

    // Filterlangan materiallar uchun route
    async getFilteredMaterials(req, res) {

        try {
            const filteredMaterials = await Material.find({
                category: { $in: ["BN-3", "BN-5", "Mel", "ip", "kraf", "qop"] },
            });


            const bn = await FinishedProduct.find({
                productName: { $in: ["Qop", "Stakan kichik", "Stakan katta"] },
            });
            const data = {
                bn,
                filteredMaterials
            }
            res.status(200).json(data);
        } catch (error) {
            console.error("Materiallarni olishda xatolik:", error);
            res.status(500).json({ message: "Serverda xatolik yuz berdi" });
        }
    };
}

module.exports = new MaterialService();


