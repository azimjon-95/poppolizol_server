const mongoose = require("mongoose");

// Plan Schema for managing salesperson monthly plans
const PlanSchema = new mongoose.Schema(
    {
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admins",
            required: [true, "Sotuvchi ID kiritilishi shart"],
        },
        month: {
            type: String,
            required: [true, "Oy kiritilishi shart"],
            match: [/^\d{4}\.\d{2}$/, "Oy formati YYYY.MM bo'lishi kerak"],
            default: () => {
                const date = new Date();
                return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}`;
            },
        },
        targetAmount: {
            type: Number,
            required: [true, "Oylik plan summasi kiritilishi shart"],
            min: [0, "Plan summasi manfiy bo'lishi mumkin emas"],
        },
        achievedAmount: {
            type: Number,
            default: 0,
            min: [0, "Bajarilgan summa manfiy bo'lishi mumkin emas"],
        },
        progress: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },
        sales: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Salecart",
            },
        ],
    },
    { timestamps: true }
);
const Plan = mongoose.model("Plan", PlanSchema);
module.exports = Plan;


