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
    totalCost: { type: Number, required: true },
    marketType: {
        type: String,
        enum: ["tashqi", "ichki"],
        default: "tashqi",
    },
    gasAmount: { type: Number },         // ✅ qo‘shildi
    electricity: { type: Number },       // ✅ qo‘shildi
    productionDate: { type: Date, default: Date.now },
}, { timestamps: true });


const ProductionHistory = mongoose.model("ProductionHistory", ProductionHistorySchema);
module.exports = ProductionHistory;


