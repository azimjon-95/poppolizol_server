// models/bonusModel.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const BonusSchema = new Schema(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Admins", // yoki Employee modeli nomi
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    period: {
      type: String, // "YYYY-MM" formatida saqlanadi
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/, // validatsiya: 2025-08 kabi
    },
    description: {
      type: String, // izoh (ixtiyoriy)
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Bonus", BonusSchema);
