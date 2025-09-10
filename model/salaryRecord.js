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
  amountOfLoaded: {
    type: Number,
    default: 0,
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
      enum: ["polizol", "Okisleniya", "ruberoid"], // mumkin bo‘lsa boshqa bo‘limlar ham qo‘shiladi
      required: true,
    },
    producedCount: { type: Number, default: 0 },
    loadedCount: { type: Number, default: 0 }, // dona hisobida
    loadedCountKg: { type: Number, default: 0 }, // kilo hisobida
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
      default: 0,
    },
    salaryPerPercent: {
      type: Number,
      default: 0,
    },
    workers: [WorkerShareSchema],
    processedItems: [{ type: Schema.Types.ObjectId, ref: "Salecart" }],
    type: {
      type: String,
      enum: ["default", "cleaning"],
      default: "default",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SalaryRecord", SalaryRecordSchema);
