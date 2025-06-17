const mongoose = require('mongoose');


// Tungi Smena Schema
const NightShiftSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
    },
    nurses: [{
        nurseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admins',
            required: true
        },
        nurseName: {
            type: String,
            required: true
        },
        shiftPrice: {
            type: Number,
            default: 150000,
        },
        scheduled: {
            type: Boolean,
            default: true,
        },
        attended: {
            type: Boolean,
            default: null, // null - hali boshlanmagan, true - kelgan, false - kelmagan
        },
        startTime: {
            type: Date,
        },
        endTime: {
            type: Date,
        },
        notes: {
            type: String,
            default: ''
        }
    }],
    status: {
        type: String,
        enum: ['scheduled', 'active', 'completed'],
        default: 'scheduled'
    },
    totalCost: {
        type: Number,
        default: 0
    },
}, { timestamps: true });

// Smena Hisoboti Schema
const ShiftReportSchema = new mongoose.Schema({
    shiftId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'NightShift',
        required: true
    },
    nurseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    activities: [{
        time: { type: Date, required: true },
        description: { type: String, required: true },
        type: {
            type: String,
            enum: ['patient_care', 'medication', 'emergency', 'routine_check', 'other'],
            default: 'other'
        }
    }],
    patientsCount: {
        type: Number,
        default: 0
    },
    emergencyCalls: {
        type: Number,
        default: 0
    },
    notes: {
        type: String,
        default: ''
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        default: 5
    }
}, { timestamps: true });

const NightShift = mongoose.model('NightShift', NightShiftSchema);
const ShiftReport = mongoose.model('ShiftReport', ShiftReportSchema);

module.exports = { NightShift, ShiftReport };
