// models/Attendance.js
const mongoose = require("mongoose");

const AttendanceSchema = new mongoose.Schema({
    employee_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admins",
        required: true
    },
    date: {
        type: Date,
        required: true,
        default: () => new Date().toISOString().split('T')[0] // Faqat sana
    },
    check_in_time: {
        type: Date,
        required: true
    },
    check_out_time: {
        type: Date,
        default: null
    },
    late_minutes: {
        type: Number,
        default: 0
    },
    early_leave_minutes: {
        type: Number,
        default: 0
    },
    overtime_minutes: {
        type: Number,
        default: 0
    },
    total_work_minutes: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['present', 'late', 'early_leave', 'overtime'],
        default: 'present'
    }
}, { timestamps: true });

// Har bir ishchi uchun kunlik bitta record
AttendanceSchema.index({ employee_id: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model("Attendance", AttendanceSchema);
module.exports = Attendance;