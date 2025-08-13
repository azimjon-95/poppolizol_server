// materialService.js
const Material = require("../model/wherehouseModel");
const Firm = require("../model/firmModel");
const Transport = require("../model/transportModel");
const Income = require("../model/Income");
const Balance = require("../model/balance");
const Expense = require("../model/expenseModel");
const FinishedProduct = require('../model/finishedProductModel');
const moment = require("moment")
const mongoose = require("mongoose");

const response = require("../utils/response");

class MaterialService {

    // async handleNewIncome(req, res) {
    //     try {
    //         const {
    //             firm: firmData,
    //             materials: materialsList,
    //             price,
    //             paymentType,
    //             vatPercentage,
    //             totalTransportCost,
    //             totalWithVat,
    //             totalWithoutVat,
    //             totalWorkerCost,
    //             customerTransport,
    //             vatAmount,
    //             workerPayments,
    //             debtPayment
    //         } = req.body;

    //         // Validation
    //         if (!firmData?._id || !mongoose.isValidObjectId(firmData._id) || !Array.isArray(materialsList) || materialsList.length === 0) {
    //             return response.error(res, "Firma ID noto‘g‘ri yoki materiallar to‘liq kiritilishi kerak");
    //         }

    //         // Find existing firm by _id
    //         const transport = await Transport.findOne({ transport: customerTransport });


    //         const firm = await Firm.findById(firmData._id);
    //         if (!firm) {
    //             return response.error(res, "Firma topilmadi");
    //         }

    //         // Prepare firm data for embedding
    //         const firmSubdocument = {
    //             name: firm.name,
    //             phone: firm.phone || null,
    //             address: firm.address || null
    //         };

    //         // Prepare materials and calculate total
    //         const incomeMaterials = [];
    //         let calculatedTotalWithoutVat = 0;
    //         const materialUpdates = [];
    //         const newMaterials = [];

    //         for (const item of materialsList) {
    //             if (!item.name || !item.quantity || !item.price || !item.currency || !item.unit) {
    //                 return response.error(res, "Material ma'lumotlari to‘liq emas");
    //             }

    //             calculatedTotalWithoutVat += item.price * item.quantity;

    //             const materialData = {
    //                 category: item.category || null,
    //                 currency: item.currency,
    //                 name: item.name,
    //                 price: item.price,
    //                 quantity: item.quantity,
    //                 transportCostPerUnit: item.transportCostPerUnit || 0,
    //                 unit: item.unit,
    //                 workerCostPerUnit: item.workerCostPerUnit || 0,
    //             };

    //             // Check for existing material
    //             const existingMaterial = await Material.findOne({ name: item.name }).lean();
    //             if (existingMaterial) {
    //                 const totalQty = existingMaterial.quantity + item.quantity;
    //                 const newPrice = Math.max(existingMaterial.avgPrice, item.price);

    //                 materialUpdates.push({
    //                     updateOne: {
    //                         filter: { _id: existingMaterial._id },
    //                         update: { quantity: totalQty, avgPrice: newPrice },
    //                     },
    //                 });
    //                 materialData.material = existingMaterial._id;
    //             } else {
    //                 newMaterials.push({
    //                     name: item.name,
    //                     unit: item.unit,
    //                     quantity: item.quantity,
    //                     price: item.price,
    //                     currency: item.currency,
    //                     category: item.category || null,
    //                     avgPrice: item.price
    //                 });
    //                 materialData.material = null;
    //             }

    //             incomeMaterials.push(materialData);
    //         }

    //         // Execute bulk operations for materials
    //         if (materialUpdates.length > 0) {
    //             await Material.bulkWrite(materialUpdates);
    //         }
    //         if (newMaterials.length > 0) {
    //             const createdMaterials = await Material.insertMany(newMaterials);
    //             let newMaterialIndex = 0;
    //             incomeMaterials.forEach((im) => {
    //                 if (!im.material) {
    //                     im.material = createdMaterials[newMaterialIndex]._id;
    //                     newMaterialIndex++;
    //                 }
    //             });
    //         }

    //         // Validate workerPayments
    //         if (workerPayments && Array.isArray(workerPayments)) {
    //             for (const payment of workerPayments) {
    //                 if (!payment.workerId || !payment.payment) {
    //                     return response.error(res, "Ishchi to‘lovlari ma'lumotlari to‘liq emas");
    //                 }
    //             }
    //         }

    //         // Calculate financials
    //         const finalVatPercentage = vatPercentage || 0;
    //         const finalVatAmount = vatAmount || (calculatedTotalWithoutVat * finalVatPercentage) / 100;
    //         const finalTotalWithVat = totalWithVat || calculatedTotalWithoutVat + finalVatAmount;
    //         const finalTotalWithoutVat = totalWithoutVat || calculatedTotalWithoutVat;
    //         const finalTotalTransportCost = totalTransportCost || materialsList.reduce((sum, item) => sum + (item.transportCostPerUnit || 0) * item.quantity, 0);
    //         const finalTotalWorkerCost = totalWorkerCost || materialsList.reduce((sum, item) => sum + (item.workerCostPerUnit || 0) * item.quantity, 0);
    //         const finalPrice = price || 0;

    //         // Handle prepaid (negative debt)
    //         const oldDebt = firm.debt || 0;
    //         let creditUsed = 0;
    //         if (oldDebt < 0) {
    //             creditUsed = Math.min(-oldDebt, finalTotalWithoutVat - finalPrice);
    //         }

    //         // Calculate debt for Firm schema (totalWithoutVat - finalPrice). Note: creditUsed is not subtracted here for correct accounting.
    //         const debtDifference = finalTotalWithoutVat - finalPrice;
    //         await Firm.findByIdAndUpdate(
    //             firmData._id,
    //             { $inc: { debt: debtDifference } },
    //             { new: true }
    //         );

    //         // Initialize debt for Income schema
    //         const debt = {
    //             initialAmount: finalTotalWithVat,
    //             remainingAmount: finalTotalWithVat - finalPrice,
    //             status: finalTotalWithVat - finalPrice <= 0 ? 'fully_paid' : finalPrice > 0 ? 'partially_paid' : 'pending',
    //             debtPayments: []
    //         };

    //         // Handle prepaid as a payment
    //         if (creditUsed > 0) {
    //             if (creditUsed > debt.remainingAmount) {
    //                 return response.error(res, "Kredit ishlatish summasi qolgan qarzdan oshib ketdi");
    //             }
    //             debt.debtPayments.push({
    //                 amount: creditUsed,
    //                 paymentMethod: 'advance',
    //                 note: 'Oldindan to‘lovdan ishlatildi',
    //                 paymentDate: new Date()
    //             });
    //             debt.remainingAmount -= creditUsed;
    //             debt.status = debt.remainingAmount === 0 ? 'fully_paid' : 'partially_paid';
    //         }

    //         // Handle initial debt payment (assuming this is for cash or other initial payment details)
    //         if (debtPayment && debtPayment.amount && debtPayment.paymentMethod) {
    //             if (!['naqt', 'bank'].includes(debtPayment.paymentMethod)) {
    //                 return response.error(res, "Noto‘g‘ri to‘lov usuli");
    //             }
    //             if (debtPayment.amount > debt.remainingAmount) {
    //                 return response.error(res, "To‘lov summasi qolgan qarzdan oshib ketdi");
    //             }
    //             debt.debtPayments.push({
    //                 amount: debtPayment.amount,
    //                 paymentMethod: debtPayment.paymentMethod,
    //                 note: debtPayment.note || '',
    //                 paymentDate: new Date()
    //             });
    //             debt.remainingAmount -= debtPayment.amount;
    //             debt.status = debt.remainingAmount === 0 ? 'fully_paid' : 'partially_paid';
    //         }

    //         // Create single income record. Note: price in income is cash + creditUsed for display.
    //         const effectivePrice = finalPrice + creditUsed;
    //         const income = await Income.create({
    //             firm: firmSubdocument, // Embedded firm data
    //             firmId: firmData._id, // Reference to Firm document
    //             materials: incomeMaterials,
    //             price: effectivePrice,
    //             paymentType: paymentType || null,
    //             vatPercentage: finalVatPercentage,
    //             totalTransportCost: finalTotalTransportCost,
    //             totalWithVat: finalTotalWithVat,
    //             totalWithoutVat: finalTotalWithoutVat,
    //             totalWorkerCost: finalTotalWorkerCost,
    //             vatAmount: finalVatAmount,
    //             workerPayments: workerPayments || [],
    //             debt,
    //             date: new Date(),
    //         });

    //         // Update Firm debt
    //         if (totalTransportCost > 0) {// Only update if transport cost is not zero
    //             if (transport) {
    //                 await Transport.findByIdAndUpdate(
    //                     transport._id,
    //                     { $inc: { balance: debtDifference } }, // mavjud summaga qo‘shadi
    //                     { new: true }
    //                 );
    //             } else {
    //                 // ceate Firm
    //                 await Transport.create({
    //                     transport: customerTransport,
    //                     balance: debtDifference
    //                 });
    //             }
    //         }

    //         return response.created(res, "Kirim muvaffaqiyatli qo‘shildi", income);
    //     } catch (error) {
    //         return response.serverError(res, "Serverda xatolik yuz berdi", { error: error.message });
    //     }
    // }
    async handleNewIncome(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();

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
                customerTransport,
                vatAmount,
                workerPayments,
                debtPayment
            } = req.body;

            // Validation
            if (!firmData?._id || !mongoose.isValidObjectId(firmData._id) || !Array.isArray(materialsList) || materialsList.length === 0) {
                await session.abortTransaction();
                session.endSession();
                return response.error(res, "Firma ID noto‘g‘ri yoki materiallar to‘liq kiritilishi kerak");
            }

            const transport = await Transport.findOne({ transport: customerTransport }).session(session);
            const firm = await Firm.findById(firmData._id).session(session);
            if (!firm) {
                await session.abortTransaction();
                session.endSession();
                return response.error(res, "Firma topilmadi");
            }

            const firmSubdocument = {
                name: firm.name,
                phone: firm.phone || null,
                address: firm.address || null
            };

            const incomeMaterials = [];
            let calculatedTotalWithoutVat = 0;
            const materialUpdates = [];
            const newMaterials = [];

            for (const item of materialsList) {
                if (!item.name || !item.quantity || !item.price || !item.currency || !item.unit) {
                    await session.abortTransaction();
                    session.endSession();
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

                const existingMaterial = await Material.findOne({ name: item.name }).lean().session(session);
                if (existingMaterial) {
                    const totalQty = existingMaterial.quantity + item.quantity;
                    const newPrice = Math.max(existingMaterial.avgPrice, item.price);

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
                    materialData.material = null;
                }

                incomeMaterials.push(materialData);
            }

            if (materialUpdates.length > 0) {
                await Material.bulkWrite(materialUpdates, { session });
            }
            if (newMaterials.length > 0) {
                const createdMaterials = await Material.insertMany(newMaterials, { session });
                let newMaterialIndex = 0;
                incomeMaterials.forEach((im) => {
                    if (!im.material) {
                        im.material = createdMaterials[newMaterialIndex]._id;
                        newMaterialIndex++;
                    }
                });
            }

            if (workerPayments && Array.isArray(workerPayments)) {
                for (const payment of workerPayments) {
                    if (!payment.workerId || !payment.payment) {
                        await session.abortTransaction();
                        session.endSession();
                        return response.error(res, "Ishchi to‘lovlari ma'lumotlari to‘liq emas");
                    }
                }
            }

            const finalVatPercentage = vatPercentage || 0;
            const finalVatAmount = vatAmount || (calculatedTotalWithoutVat * finalVatPercentage) / 100;
            const finalTotalWithVat = totalWithVat || calculatedTotalWithoutVat + finalVatAmount;
            const finalTotalWithoutVat = totalWithoutVat || calculatedTotalWithoutVat;
            const finalTotalTransportCost = totalTransportCost || materialsList.reduce((sum, item) => sum + (item.transportCostPerUnit || 0) * item.quantity, 0);
            const finalTotalWorkerCost = totalWorkerCost || materialsList.reduce((sum, item) => sum + (item.workerCostPerUnit || 0) * item.quantity, 0);
            const finalPrice = price || 0;

            const oldDebt = firm.debt || 0;
            let creditUsed = 0;
            if (oldDebt < 0) {
                creditUsed = Math.min(-oldDebt, finalTotalWithoutVat - finalPrice);
            }

            const debtDifference = finalTotalWithoutVat - finalPrice;
            await Firm.findByIdAndUpdate(
                firmData._id,
                { $inc: { debt: debtDifference } },
                { new: true, session }
            );

            const debt = {
                initialAmount: finalTotalWithVat,
                remainingAmount: finalTotalWithVat - finalPrice,
                status: finalTotalWithVat - finalPrice <= 0 ? 'fully_paid' : finalPrice > 0 ? 'partially_paid' : 'pending',
                debtPayments: []
            };

            if (creditUsed > 0) {
                if (creditUsed > debt.remainingAmount) {
                    await session.abortTransaction();
                    session.endSession();
                    return response.error(res, "Kredit ishlatish summasi qolgan qarzdan oshib ketdi");
                }
                debt.debtPayments.push({
                    amount: creditUsed,
                    paymentMethod: 'advance',
                    note: 'Oldindan to‘lovdan ishlatildi',
                    paymentDate: new Date()
                });
                debt.remainingAmount -= creditUsed;
                debt.status = debt.remainingAmount === 0 ? 'fully_paid' : 'partially_paid';
            }

            if (debtPayment && debtPayment.amount && debtPayment.paymentMethod) {
                if (!['naqt', 'bank'].includes(debtPayment.paymentMethod)) {
                    await session.abortTransaction();
                    session.endSession();
                    return response.error(res, "Noto‘g‘ri to‘lov usuli");
                }
                if (debtPayment.amount > debt.remainingAmount) {
                    await session.abortTransaction();
                    session.endSession();
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

            const effectivePrice = finalPrice + creditUsed;
            const income = await Income.create([{
                firm: firmSubdocument,
                firmId: firmData._id,
                materials: incomeMaterials,
                price: effectivePrice,
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
            }], { session });

            if (totalTransportCost > 0) {
                if (transport) {
                    await Transport.findByIdAndUpdate(
                        transport._id,
                        { $inc: { balance: totalTransportCost } },
                        { new: true, session }
                    );
                } else {
                    await Transport.create([{
                        transport: customerTransport,
                        balance: totalTransportCost
                    }], { session });
                }
            }

            await session.commitTransaction();
            session.endSession();

            return response.created(res, "Kirim muvaffaqiyatli qo‘shildi", income[0]);
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
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


