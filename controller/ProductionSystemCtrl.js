const Material = require('../model/wherehouseModel');
const ProductNorma = require('../model/productNormaSchema');
const FinishedProduct = require('../model/finishedProductModel');
const ProductionHistory = require('../model/ProductionHistoryModel');
const HistoryProduction = require('../model/HistoryProductionModel');
const response = require('../utils/response');
const mongoose = require("mongoose");

class ProductionSystem {
    // Get all finished products
    async finishedProducts(req, res) {
        try {
            const products = await FinishedProduct.find();
            return response.success(res, "Finished products retrieved successfully", products);
        } catch (error) {
            return response.serverError(res, "Failed to retrieve finished products", error.message);
        }
    }

    // Get production history
    async productionHistory(req, res) {
        try {
            const history = await ProductionHistory.find()
                .populate('productNormaId')
                .sort({ createdAt: -1 });
            return response.success(res, "Production history retrieved successfully", history);
        } catch (error) {
            return response.serverError(res, "Failed to retrieve production history", error.message);
        }
    }

    // Production process
    async productionProcess(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { productNormaId, quantityToProduce, selectedMarket } = req.body;

            // Validate selectedMarket
            if (!['tashqi', 'ichki'].includes(selectedMarket)) {
                await session.abortTransaction();
                session.endSession();
                return response.error(res, "Invalid market type. Must be 'tashqi' or 'ichki'");
            }

            // Get product norma
            const productNorma = await ProductNorma.findById(productNormaId)
                .populate('materials.materialId')
                .session(session);

            if (!productNorma) {
                await session.abortTransaction();
                session.endSession();
                return response.notFound(res, "Product norma not found");
            }

            // Check if enough materials available
            let totalCost = 0;
            const materialsUsed = [];

            for (const requirement of productNorma.materials) {
                const material = requirement.materialId;
                const requiredQuantity = requirement.quantity * quantityToProduce;

                if (material.quantity < requiredQuantity) {
                    await session.abortTransaction();
                    session.endSession();
                    return response.error(res, `Insufficient ${material.name}. Required: ${requiredQuantity}, Available: ${material.quantity}`);
                }

                const cost = material.price * requiredQuantity;
                totalCost += cost;

                materialsUsed.push({
                    materialId: material._id,
                    materialName: material.name,
                    quantityUsed: requiredQuantity,
                    unitPrice: material.price,
                });
            }

            // Deduct materials from warehouse
            for (const requirement of productNorma.materials) {
                const material = requirement.materialId;
                const requiredQuantity = requirement.quantity * quantityToProduce;

                await Material.findByIdAndUpdate(
                    material._id,
                    { $inc: { quantity: -requiredQuantity } },
                    { session }
                );
            }

            // Add to finished products or update existing
            const existingProduct = await FinishedProduct.findOne({
                productName: productNorma.productName,
                category: productNorma.category,
                size: productNorma.size,
                marketType: selectedMarket, // Match marketType
            }).session(session);

            if (existingProduct) {
                await FinishedProduct.findByIdAndUpdate(
                    existingProduct._id,
                    {
                        $inc: { quantity: quantityToProduce },
                        productionCost: (existingProduct.productionCost * existingProduct.quantity + totalCost) / (existingProduct.quantity + quantityToProduce),
                    },
                    { session }
                );
            } else {
                await FinishedProduct.create([{
                    productName: productNorma.productName,
                    category: productNorma.category,
                    quantity: quantityToProduce,
                    size: productNorma.size,
                    marketType: selectedMarket,
                    productionCost: totalCost / quantityToProduce,
                }], { session });
            }

            // Record production history
            await ProductionHistory.create([{
                productNormaId: productNorma._id,
                productName: productNorma.productName,
                quantityProduced: quantityToProduce,
                materialsUsed,
                totalCost,
                marketType: selectedMarket,
            }], { session });

            await session.commitTransaction();
            return response.created(res, `Successfully produced ${quantityToProduce} units of ${productNorma.productName} for ${selectedMarket} market`, { totalCost });

        } catch (error) {
            await session.abortTransaction();
            return response.error(res, "Production process failed", error.message);
        } finally {
            session.endSession();
        }
    }


    async createBn5Production(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const {
                date,
                bn3Amount,
                wasteAmount,
                gasAmount,
                temperature,
                electricEnergy,
                boilingHours,
                electricity,
                extra,
                price,
                notes,
            } = req.body;

            // Validate required fields
            if (!date || !bn3Amount || !wasteAmount || !price) {
                await session.abortTransaction();
                session.endSession();
                return response.error(res, "Missing required fields: date, bn3Amount, wasteAmount, and price are mandatory");
            }

            const finalBn5 = bn3Amount - wasteAmount;
            const unitCost = Number(price);

            if (isNaN(unitCost) || unitCost <= 0) {
                await session.abortTransaction();
                session.endSession();
                return response.error(res, "Invalid price value");
            }

            if (finalBn5 < 0) {
                await session.abortTransaction();
                session.endSession();
                return response.error(res, "Final BN-5 quantity cannot be negative");
            }

            // Check BN-3 availability
            const bn3Material = await Material.findOne({ category: 'BN-3' }).session(session);
            if (!bn3Material || bn3Material.quantity < bn3Amount) {
                await session.abortTransaction();
                session.endSession();
                return response.error(res, `Insufficient BN-3. Required: ${bn3Amount}, Available: ${bn3Material?.quantity || 0}`);
            }

            // Update or create BN-5 material
            let bn5Material = await Material.findOne({ category: 'BN-5' }).session(session);
            if (bn5Material) {
                const oldQuantity = bn5Material.quantity;
                const oldPrice = Number(bn5Material.price) || 0;
                const totalQuantity = oldQuantity + finalBn5;
                const weightedAveragePrice = ((oldQuantity * oldPrice) + (finalBn5 * unitCost)) / totalQuantity;

                bn5Material.quantity = totalQuantity;
                bn5Material.price = weightedAveragePrice;
                await bn5Material.save({ session });
            } else {
                bn5Material = await Material.create([{
                    name: 'BN-5',
                    quantity: finalBn5,
                    price: unitCost,
                    currency: 'sum',
                    unit: 'kilo',
                    category: 'BN-5',
                }], { session });
                bn5Material = bn5Material[0];
            }

            // Deduct BN-3 quantity
            bn3Material.quantity -= bn3Amount;
            await bn3Material.save({ session });

            // Record production history
            await HistoryProduction.create([{
                date,
                bn3Amount,
                wasteAmount,
                finalBn5,
                gasAmount,
                temperature,
                electricEnergy,
                boilingHours,
                electricity,
                extra,
                price: unitCost,
                notes,
            }], { session });

            await session.commitTransaction();
            return response.created(res, `Successfully produced ${finalBn5} units of BN-5`, { finalBn5, price: unitCost });

        } catch (error) {
            await session.abortTransaction();
            return response.serverError(res, "Failed to produce BN-5", error.message);
        } finally {
            session.endSession();
        }
    }
}

module.exports = new ProductionSystem();