const Praymer = require('../model/praymer');
const Material = require('../model/wherehouseModel');
const mongoose = require('mongoose');
const Response = require('../utils/response'); // response class fayliga yo‘lni moslashtiring
const FinishedProduct = require("../model/finishedProductModel");


class PraymerController {

    // CREATE
    static async createProduction(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const {
                productionName,
                productionQuantity,
                salePricePerBucket,
                totals,
                items
            } = req.body;
            if (!productionName || !productionQuantity || !totals || !totals.costAll || !salePricePerBucket) {
                await session.abortTransaction();
                session.endSession();
                return Response.error(res, 'Missing required fields');
            }

            // Materials quantity ni yangilash
            if (items && items.length > 0) {
                for (const item of items) {
                    // Faqat materialId mavjud bo'lgan itemlarni qaraymiz
                    if (item._id && mongoose.Types.ObjectId.isValid(item._id)) {
                        const material = await Material.findById(item._id).session(session);

                        if (material) {
                            // Yetarli miqdor borligini tekshirish
                            if (material.quantity < item.baseQty) {
                                await session.abortTransaction();
                                session.endSession();
                                return Response.error(res, `Yetarli ${material.name} yo'q. Mavjud: ${material.quantity}, Kerak: ${item.baseQty}`);
                            }

                            // Material miqdorini kamaytirish
                            material.quantity -= item.baseQty;
                            await material.save({ session });
                        } else {
                            await session.abortTransaction();
                            session.endSession();
                            return Response.error(res, `Material topilmadi: ${item.name}`);
                        }
                    }
                    // Agar materialId yo'q bo'lsa (masalan, labor kabi), uni o'tkazib yuboramiz
                }
            }

            // FinishedProductni tekshirish
            let finishedProduct = await FinishedProduct.findOne({
                productName: productionName,
                isDefective: false
            }).session(session);

            if (finishedProduct) {
                finishedProduct.quantity += productionQuantity;
                finishedProduct.productionCost = Math.max(finishedProduct.productionCost || 0, totals.costAll);
                finishedProduct.sellingPrice = Math.max(finishedProduct.sellingPrice || 0, salePricePerBucket);
                await finishedProduct.save({ session });
            } else {
                let [newFinishedProduct] = await FinishedProduct.create([{
                    productName: productionName,
                    category: productionName === 'Mastika' ? 'Mastika' : 'Praymer', // Dynamic category based on productionName
                    quantity: productionQuantity,
                    productionCost: totals.costAll,
                    sellingPrice: salePricePerBucket,
                    productionDate: new Date(),
                }], { session });

                finishedProduct = newFinishedProduct;
            }

            let [production] = await Praymer.create([req.body], { session });
            // Commit
            await session.commitTransaction();
            session.endSession();

            return Response.created(res, 'Ishlab chiqarish muvaffaqiyatli yaratildi', {
                production, // Generic name for the created document
                finishedProduct
            });
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            return Response.error(res, error.message);
        }
    }

    // READ (Get all)
    static async getAllProductions(req, res) {
        try {
            const productions = await Praymer.find();
            return Response.success(res, 'Barcha ishlab chiqarishlar muvaffaqiyatli olindi', productions);
        } catch (error) {
            return Response.serverError(res, error.message);
        }
    }

    // READ (Get by ID)
    static async getProductionById(req, res) {
        try {
            const production = await Praymer.findById(req.params.id);
            if (!production) {
                return Response.notFound(res, 'Ishlab chiqarish topilmadi');
            }
            return Response.success(res, 'Ishlab chiqarish muvaffaqiyatli olindi', production);
        } catch (error) {
            return Response.serverError(res, error.message);
        }
    }

    // UPDATE
    static async updateProduction(req, res) {
        try {
            const production = await Praymer.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
            if (!production) {
                return Response.notFound(res, 'Ishlab chiqarish topilmadi');
            }
            return Response.success(res, 'Ishlab chiqarish muvaffaqiyatli yangilandi', production);
        } catch (error) {
            return Response.error(res, error.message);
        }
    }

    // DELETE
    static async deleteProduction(req, res) {
        try {
            const production = await Praymer.findByIdAndDelete(req.params.id);
            if (!production) {
                return Response.notFound(res, 'Ishlab chiqarish topilmadi');
            }
            return Response.success(res, 'Ishlab chiqarish muvaffaqiyatli o‘chirildi');
        } catch (error) {
            return Response.serverError(res, error.message);
        }
    }

    // GET one month data (optimized with start and end dates)
    static async getOneMonthData(req, res) {
        try {
            const { startDate, endDate } = req.params; // Extract startDate and endDate from query params
            // Validate startDate and endDate
            if (!startDate || !endDate) {
                return Response.error(res, 'startDate va endDate kiritilishi shart');
            }

            // Parse dates and ensure they are valid
            const start = new Date(startDate);
            const end = new Date(endDate);

            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return Response.error(res, 'Noto‘g‘ri sana formati');
            }

            // Set endDate to include the full day (23:59:59.999)
            end.setHours(23, 59, 59, 999);

            // Query the database for production data within the date range
            const productions = await Praymer.find({
                createdAt: {
                    $gte: start,
                    $lte: end
                }
            }).sort({ createdAt: -1 });

            return Response.success(res, 'Ishlab chiqarish ma‘lumotlari muvaffaqiyatli olindi', productions);
        } catch (error) {
            return Response.serverError(res, error.message);
        }
    }
}

module.exports = PraymerController;