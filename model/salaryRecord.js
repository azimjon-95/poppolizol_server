const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const WorkerShareSchema = new Schema({
  employee: {
    type: Schema.Types.ObjectId,
    ref: "Admins",
    required: true,
  },
  percentage: {
    type: Number,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
});

const SalaryRecordSchema = new Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    department: {
      type: String,
      enum: ["polizol", "ochisleniya", "bt_5"], // mumkin bo‘lsa boshqa bo‘limlar ham qo‘shiladi
      required: true,
    },
    producedCount: {
      type: Number,
      required: true,
    },
    loadedCount: {
      type: Number,
      default: 0,
    },
    totalSum: {
      type: Number,
      required: true,
    },
    salaryPerPercent: {
      type: Number,
      required: true,
    },
    workers: [WorkerShareSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("SalaryRecord", SalaryRecordSchema);
