const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admins",
  },
  date: {
    type: Date,
    required: true,
  },
  percentage: {
    type: "number",
    minimum: 0.33,
    maximum: 2.2,
    errorMessage: "Davomat foizi 0.33 dan 2.2 gacha bo‘lishi kerak",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  unit: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("Attendance", attendanceSchema);
