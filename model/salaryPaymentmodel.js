const mongoose = require('mongoose');

const salaryPaymentSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        required: true
    },
    month: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    year: {
        type: Number,
        required: true,
        min: 2020
    },
    baseSalary: {
        type: Number,
        required: true,
        min: 0
    },
    advanceAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    penaltyAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    totalPaid: {
        type: Number,
        required: true,
        min: 0
    },
    remainingAmount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: [
            "to'liq_to'lanmagan",
            "to'liq_to'langan",
            "ortiqcha_to'langan",
            "avans_qoplanmoqda",
            "qarz_otkazilgan"
        ],
        default: "to'liq_to'lanmagan"
    },
    advanceDebt: { // Avans qarzi
        type: Number,
        default: 0,
        min: 0
    },
    paymentHistory: [{
        amount: {
            type: Number,
            required: true
        },
        paymentDate: {
            type: Date,
            default: Date.now
        },
        paymentMethod: {
            type: String,
            enum: ['naqt', 'bank'],
            required: true
        },
        salaryType: {
            type: String,
            enum: ["avans", "oylik"],
        },
        description: {
            type: String,
            default: ''
        },
        expenseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Expense'
        }
    }],
    notes: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Compound index for unique salary record per employee per month
salaryPaymentSchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });
salaryPaymentSchema.index({ status: 1 });

const SalaryPayment = mongoose.model('SalaryPayment', salaryPaymentSchema);
module.exports = SalaryPayment;


