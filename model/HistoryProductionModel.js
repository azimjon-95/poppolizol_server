const mongoose = require('mongoose');

const historyProductionSchema = new mongoose.Schema({
    date: {
        type: String, // yoki Date agar ISO formatda saqlamoqchi bo‘lsangiz
        required: true,
    },
    bn3Amount: {
        type: Number,
        required: true,
    },
    wasteAmount: {
        type: Number,
        required: true,
    },
    finalBn5: {
        type: Number,
        required: true,
    },
    gasAmount: {
        type: Number,
        required: true,
    },
    temperature: {
        type: Number,
        required: false,
    },
    electricEnergy: {
        type: Number,
        required: false,
    },
    boilingHours: {
        type: Number,
        required: false,
    },
    electricity: {
        type: Number,
        required: false,
    },
    extra: {
        type: Number,
        required: false,
        default: 0,
    },
    price: {
        type: Number,
        required: true,
    },
    notes: {
        type: String,
        default: '',
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('HistoryProduction', historyProductionSchema);
