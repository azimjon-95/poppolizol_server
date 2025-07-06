// materialService.js
const Material = require("../model/wherehouseModel");
const Firm = require("../model/firmModel");
const Income = require("../model/Income");
const FinishedProduct = require('../model/finishedProductModel');

const Response = require("../utils/response");

class MaterialService {
    async handleNewIncome(req, res) {
        try {
            const { firm: firmData, materials: materialsList, paidAmount } = req.body;

            // Validation
            if (!firmData?.name || !Array.isArray(materialsList) || materialsList.length === 0) {
                return Response.error(res, "Firma va materiallar to‘liq kiritilishi kerak");
            }

            // Find or create firm
            let firm = await Firm.findOne({ name: firmData.name }).lean();
            if (!firm) {
                firm = await Firm.create(firmData);
            }

            const incomeMaterials = [];
            let totalAmount = 0;

            // Bulk operations for materials
            const materialUpdates = [];
            const newMaterials = [];

            for (const item of materialsList) {
                if (!item.name || !item.quantity || !item.price || !item.currency || !item.unit) {
                    return Response.error(res, "Material ma'lumotlari to‘liq emas");
                }

                totalAmount += item.price * item.quantity;
                incomeMaterials.push({
                    material: null, // Will be updated after material creation/update
                    quantity: item.quantity,
                    price: item.price,
                    currency: item.currency,
                    category: item.category,
                });

                const existingMaterial = await Material.findOne({ name: item.name }).lean();
                if (existingMaterial) {
                    const totalQty = existingMaterial.quantity + item.quantity;
                    const totalCost = existingMaterial.avgPrice * existingMaterial.quantity + item.price * item.quantity;
                    const newAvgPrice = totalCost / totalQty;

                    materialUpdates.push({
                        updateOne: {
                            filter: { _id: existingMaterial._id },
                            update: { quantity: totalQty, avgPrice: newAvgPrice },
                        },
                    });
                    incomeMaterials[incomeMaterials.length - 1].material = existingMaterial._id;
                } else {
                    newMaterials.push({
                        name: item.name,
                        unit: item.unit,
                        quantity: item.quantity,
                        price: item.price,
                        currency: item.currency,
                        category: item.category,
                    });
                }
            }

            // Execute bulk operations
            if (materialUpdates.length > 0) {
                await Material.bulkWrite(materialUpdates);
            }
            if (newMaterials.length > 0) {
                const createdMaterials = await Material.insertMany(newMaterials);
                // Update incomeMaterials with new material IDs
                createdMaterials.forEach((material, index) => {
                    incomeMaterials.find((im) => im.material === null).material = material._id;
                });
            }

            // Create income record
            const income = await Income.create({
                firm: firm._id,
                materials: incomeMaterials,
                totalAmount,
                paidAmount,
            });

            return Response.created(res, "Kirim muvaffaqiyatli qo‘shildi", income);
        } catch (error) {
            console.error("handleNewIncome xatolik:", error);
            return Response.serverError(res, "Serverda xatolik yuz berdi", { error: error.message });
        }
    }

    //Firm create
    async createFirm(req, res) {
        try {
            const existingFirm = await Firm.findOne({ name: req.body.name });
            if (existingFirm) {
                return Response.error(res, "Firma allaqachon mavjud");
            }

            const firm = await Firm.create(req.body);
            return Response.created(res, "Firma muvaffaqiyatli qo‘shildi", firm);
        } catch (error) {
            return Response.serverError(res, "Serverda xatolik yuz berdi", { error: error.message });
        }
    }
    // Get Firms
    async getFirms(req, res) {
        try {
            const firms = await Firm.find();
            return Response.success(res, "Firmalar muvaffaqiyatli o'qildi", firms);
        } catch (error) {
            return Response.serverError(res, "Serverda xatolik yuz berdi", { error: error.message });
        }
    }

    //Income
    async getIncomes(req, res) {
        try {
            const incomes = await Income.find()
                .populate("firm")
                .populate("materials.material");
            return Response.success(res, "Kirimlar muvaffaqiyatli o'qildi", incomes);
        } catch (error) {
            return Response.serverError(res, "Serverda xatolik yuz berdi", { error: error.message });
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


