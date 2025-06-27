const mongoose = require("mongoose");

const FinishedProductSchema = new mongoose.Schema({
    productName: {
        type: String,
        required: true,
        trim: true,
    },
    category: {
        type: String,
        required: true,
        trim: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 0,
    },
    marketType: {
        type: String,
        enum: ["tashqi", "ichki"],
        default: "tashqi",
    },
    size: {
        type: String,
        required: true,
    },
    productionDate: {
        type: Date,
        default: Date.now,
    },
    productionCost: {
        type: Number,
        required: true,
    },
}, { timestamps: true });

const FinishedProduct = mongoose.model("FinishedProducts", FinishedProductSchema);
module.exports = FinishedProduct;
