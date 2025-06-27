const mongoose = require("mongoose");

const IncomeSchema = new mongoose.Schema({
    firm: { type: mongoose.Schema.Types.ObjectId, ref: "Firm", required: true },
    materials: [
        {
            material: { type: mongoose.Schema.Types.ObjectId, ref: "materials" },
            quantity: Number,
            price: Number,
            currency: String,
        },
    ],
    totalAmount: Number,
    paidAmount: Number,
    date: { type: Date, default: Date.now },
}, { timestamps: true });

const Income = mongoose.model("Income", IncomeSchema);
module.exports = Income;
