const { Schema, model } = require("mongoose");
const mongoose = require("mongoose");

const schema = new Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "patients",
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admins",
      required: true,
    },
    paymentType: { type: String, enum: ["karta", "naqt"], required: true },
    payment_status: { type: Boolean, default: false },
    payment_amount: { type: Number, required: true },
    sickname: { type: String },
    view: { type: Boolean, default: false },
    order_number: { type: Number },
    retseptList: { type: String },
    description: { type: String },
    rentgen: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rentgen",
    },
    labaratoryResult: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Labaratory",
    },
    startTime: { type: Date, required: true, default: Date.now },
    endTime: { type: Date },
    services: [
      {
        name: { type: String, required: true },
        price: { type: Number, required: true },
      },
    ],
  },
  { timestamps: true }
);

const StoriesDB = model("stories", schema);

module.exports = StoriesDB;