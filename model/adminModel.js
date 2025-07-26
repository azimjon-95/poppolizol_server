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
    plans: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Plan",
      },
    ],
    role: {
      type: String,
      enum: [
        "ofis xodimi",
        "ishlab chiqarish",
        "boshqa ishchilar"
      ],
      default: "boshqa ishchilar",

    },
    unit: {
      type: String,
      enum: [
        "direktor",
        "buxgalteriya",
        "menejir",
        "ombor",
        "sifat nazorati",

        "elektrik",
        "transport",
        "avto kara",
        "xavfsizlik",
        "tozalash",
        "oshxona",

        "sotuvchi",
        "sotuvchi eksport",
        "sotuvchi menejir",

        "polizol",
        "polizol ish boshqaruvchi",
        "rubiroid",
        "rubiroid ish boshqaruvchi",
        "ochisleniya",
        "ochisleniya ish boshqaruvchi",

        "boshqa"
      ],
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


