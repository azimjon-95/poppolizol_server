const mongoose = require('mongoose');

const penaltySchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    reason: {
        type: String,
        required: true,
        trim: true
    },
    penaltyType: {
        type: String,
        required: true,
        enum: ['kechikish', 'kelmaslik', 'qoida_buzish', 'sifat_muammosi', 'boshqa'],
        default: 'boshqa'
    },
    status: {
        type: String,
        enum: ['aktiv', 'to\'langan', 'bekor_qilingan'],
        default: 'aktiv'
    },
    appliedDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    paidDate: {
        type: Date
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
    createdBy: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

// Index for better performance
penaltySchema.index({ employeeId: 1, month: 1, year: 1 });
penaltySchema.index({ status: 1 });

const Penalty = mongoose.model('Penalty', penaltySchema);
module.exports = Penalty;