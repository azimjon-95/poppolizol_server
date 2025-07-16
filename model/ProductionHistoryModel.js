const mongoose = require("mongoose");

const ProductionHistorySchema = new mongoose.Schema({
    productNormaId: { type: mongoose.Schema.Types.ObjectId, ref: "productNorma", required: true },
    productName: { type: String, required: true },
    quantityProduced: { type: Number, required: true },
    materialsUsed: [{
        materialId: { type: mongoose.Schema.Types.ObjectId, ref: "materials" },
        materialName: String,
        quantityUsed: Number,
        unitPrice: Number,
    }],
    materialStatistics: [{
        materialId: { type: mongoose.Schema.Types.ObjectId, ref: "materials" },
        materialName: String,
        unit: String,
        requiredQuantity: Number,
        consumedQuantity: Number,
        status: { type: String, enum: ["exceed", "insufficient", "equal"] },
        difference: Number,
    }],
    totalCost: { type: Number, required: true },
    marketType: {
        type: String,
        enum: ["tashqi", "ichki"],
        default: "tashqi",
    },
    gasAmount: { type: Number },
    electricity: { type: Number },
    productionDate: { type: Date, default: Date.now },
}, { timestamps: true });

const ProductionHistory = mongoose.model("ProductionHistory", ProductionHistorySchema);
module.exports = ProductionHistory;

