const { Schema, model } = require("mongoose");

const clientSchema = new Schema(
  {
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    idNumber: { type: String },
    phone: { type: String, required: true },
    address: { type: String, required: true, default: "Namangan viloyati" },
    year: { type: String, required: true },
    treating: { type: Boolean, default: false },
    debtor: { type: Boolean, default: false },
    gender: { type: String },
  },
  { timestamps: true }
);

const PatientModel = model("patients", clientSchema);
module.exports = PatientModel;
