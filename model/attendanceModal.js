// models/Attendance.js
const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admins",
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  workType: {
    type: String,
    enum: [
      "full_day", // 1.0
      "half_day", // 0.5
      "third_day", // 0.33
      "three_quarter", // 0.75
      "one_and_half", // 1.5
      "two_days", // 2.0
    ],
    required: true,
  },
  percentage: {
    type: Number,
    required: true,
    enum: [0.33, 0.5, 0.75, 1, 1.5, 2],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  department: {
    type: String,
    required: true, // yoki false, agar ba'zan bo‘lmasligi mumkin
  },
});

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
