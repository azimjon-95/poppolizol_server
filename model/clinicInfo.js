const mongoose = require("mongoose");

const clinicInfoSchema = new mongoose.Schema({
  clinicName: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  logo: {
    type: String,
  },
  // Ish vaqti sozlamalari
  work_schedule: {
    start_time: {
      type: String,
      default: "08:00",
      required: true,
    },
    end_time: {
      type: String,
      default: "17:00",
      required: true,
    },
    work_days: {
      type: [String],
      default: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
      enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
    },
    lunch_break: {
      start_time: {
        type: String,
        default: "12:00",
      },
      end_time: {
        type: String,
        default: "13:00",
      },
      enabled: {
        type: Boolean,
        default: true,
      },
    },
  },
});

module.exports = mongoose.model("ClinicInfo", clinicInfoSchema);