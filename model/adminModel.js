const mongoose = require("mongoose");
const AdminSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    login: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      default: "director",
      enum: ["reception", "director", "doctor", "nurse", "cleaner"],
    },
    permissions: {
      type: [String],
      default: [],
    },
    salary_per_month: {
      type: Number,
      default: 0,
    },
    specialization: {
      type: String,
      default: "",
    },
    phone: {
      type: String,
      required: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
    },
    birthday: {
      type: Date,
    },
    salary_type: {
      type: String,
      default: "fixed",
      enum: ["fixed", "percentage"],
    },
    percentage_from_admissions: {
      type: Number,
      default: 0,
    },
    servicesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Services",
    },
    // for attendance
    idCardNumber: {
      type: String,
      unique: true,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admins", AdminSchema);


