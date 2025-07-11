const mongoose = require("mongoose");

const EmployeeSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "Ism kiritilishi shart"],
      trim: true,
    },
    middleName: {
      type: String,
      trim: true,
      default: "",
    },
    lastName: {
      type: String,
      required: [true, "Familya kiritilishi shart"],
      trim: true,
    },
    department: {
      type: String,
      required: [true, "Bo'lim kiritilishi shart"],
      enum: [
        "ishlab_chiqarish",
        "sifat_nazorati",
        "saler_meneger",
        "ombor",
        "buxgalteriya",
        "elektrik",
        "transport",
        "xavfsizlik",
        "tozalash",
        "oshxona",
        "Sotuvchi",
      ],
      default: "ishlab_chiqarish",
    },
    position: {
      type: String,
      required: [true, "Lavozim kiritilishi shart"],
      trim: true,
    },
    experience: {
      type: String,
      trim: true,
      default: "",
    },
    passportSeries: {
      type: String,
      required: [true, "Pasport seriyasi kiritilishi shart"],
      trim: true,
      unique: true,
      match: [/^[A-Z]{2}\d{7}$/, "Pasport seriyasi formati noto'g'ri"],
    },
    phone: {
      type: String,
      required: [true, "Telefon raqami kiritilishi shart"],
      trim: true,
      match: [/^\+998\d{9}$/, "Telefon raqami formati noto'g'ri"],
    },
    address: {
      type: String,
      required: [true, "Manzil kiritilishi shart"],
      trim: true,
    },
    paymentType: {
      type: String,
      required: [true, "To'lov turi kiritilishi shart"],
      enum: ["oylik", "kunlik", "soatlik", "ishbay"],
      default: "oylik",
    },
    salary: {
      type: Number,
      required: [true, "Maosh kiritilishi shart"],
      min: [0, "Maosh manfiy bo'lishi mumkin emas"],
    },
    isOfficeWorker: {
      type: Boolean,
      default: false,
    },
    login: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      default: "",
    },
    plans: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Plan",
      },
    ],
    unit: {
      type: String,
      enum: ["polizol", "rubiroid", "ochisleniya", "boshqa"],
      default: "boshqa",
    },
    unitHeadPassword: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admins", EmployeeSchema);
