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

    productionDate: {
        type: Date,
        default: Date.now,
    },
    productionCost: {
        type: Number,
        required: true,
    },
    sellingPrice: { // Sotuv narxi
        type: Number,
        required: true,
        min: 0,
    },

    isReturned: {
        type: Boolean,
        default: false,
    },

    returnInfo: {
        returnReason: {
            type: String,
            trim: true,
            default: '',
        },
        returnDescription: {
            type: String,
            trim: true,
            default: '',
        },
        returnDate: {
            type: Date,
            default: null,
        },
    },

}, { timestamps: true });

const FinishedProduct = mongoose.model("FinishedProducts", FinishedProductSchema);
module.exports = FinishedProduct;


