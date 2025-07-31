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
      enum: ["polizol", "ochisleniya", "ruberoid"], // mumkin bo‘lsa boshqa bo‘limlar ham qo‘shiladi
      required: true,
    },
    producedCount: {
      // polizol
      type: Number,
      default: 0,
    },
    loadedCount: {
      // yuklangan yuk soni
      type: Number,
      default: 0,
    },
    btm_3: {
      // qozonga tashlangan bitum 3 marka
      type: Number,
      default: 0,
    },
    btm_5: {
      // qozonga tashlangan bitum 3 markadan ajrab chiqqan bitum 5 marka
      type: Number,
      default: 0,
    },
    btm_5_sale: {
      // bitum 5 marka sotuv uchun ishlab chiqarilgan miqdor
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
