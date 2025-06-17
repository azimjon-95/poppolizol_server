const mongoose = require("mongoose");

const roomStorySchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "patients",
      required: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admins",
    },
    startDay: { type: String, default: new Date() },
    endDay: { type: String, default: "0" },
    paidDays: [
      {
        day: Number,
        date: String,
        price: Number,
        isPaid: Boolean,
      },
    ],
    payments: [
      {
        amount: Number,
        paymentType: String,
        date: { type: Date, default: Date.now },
      },
    ],
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("RoomStory", roomStorySchema);
