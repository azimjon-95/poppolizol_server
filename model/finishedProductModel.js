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
    sellingPrice: {
        type: Number,
        required: true,
        min: 0,
    },
    isReturned: {
        type: Boolean,
        default: false,
    },
    returnInfo: [{
        returnReason: {
            type: String,
            trim: true,
            default: "",
        },
        returnDescription: {
            type: String,
            trim: true,
            default: "",
        },
        returnDate: {
            type: Date,
            default: null,
        },
        returnedQuantity: {
            type: Number,
            min: [0, 'Qaytarilgan miqdor 0 dan kichik bo‘lishi mumkin emas'],
        },
        companyName: {
            type: String,
            trim: true,
            default: "",
        },
        refundedAmount: {
            type: Number,
            min: [0, 'Qaytarilgan summa 0 dan kichik bo‘lishi mumkin emas'],
        },
    }],
    // Brak (sifatsiz) mahsulotlar uchun qo'shimcha maydonlar
    isDefective: {
        type: Boolean,
        default: false,
    },
    defectiveInfo: {
        defectiveReason: {
            type: String,
            trim: true,
            default: "",
        },
        defectiveDescription: {
            type: String,
            trim: true,
            default: "",
        },
        defectiveDate: {
            type: Date,
            default: null,
        },
    },
}, { timestamps: true });

const FinishedProduct = mongoose.model("FinishedProducts", FinishedProductSchema);
module.exports = FinishedProduct;




