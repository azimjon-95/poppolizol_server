const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String
    },
    roomNumber: {
      type: Number,
      unique: true,
    },
    floor: {
      type: Number,
      required: true,
    },
    usersNumber: {
      type: Number,
      required: true,
    },
    roomType: {
      type: String,
      enum: [
        "davolanish",
        "vrach_kabineti",
        "mehmonxona",
        "assosiy_zal",
        "sport_zal",
        "kutubxona",
        "massaj_xonasi",
        "uxlash_xonasi",
        "kuzatuv_xonasi",
        "izolyator",
        "operatsiya_xonasi",
        "intensiv_terapiya",
        "rentgen_xonasi",
        "laboratoriya",
        "qabul_xonasi",
        "resepshn",
        "muolaja_xonasi",
        "sterilizatsiya_xonasi",
        "tibbiy_qadoqlash_xonasi",
        "konsultatsiya_xonasi",
        "psixolog_xonasi",
        "administratsiya",
        "personal_xonasi",
        "arxiv",
        "omborxona",
        "emlash_xonasi",
        "fizioterapiya_xonasi",
        "ultratovush_xonasi",
        "EKG_xonasi",
        "dializ_xonasi",
        "quvvatlash_xonasi",
        "ginekologiya_xonasi",
        "lola_xonasi",
        "karantin_xonasi",
        "karavot_almashish_xonasi",
        "kiyinish_xonasi",
        "xodimlar_ovqatlanish_xonasi",
        "mehmonlar_kutish_xonasi",
        "ta'mirlash_xonasi",
        "texnik_xona",
        "dush_xonasi",
        "tualet_xonasi",
        "yuvinish_xonasi",
        "kislorod_xonasi",
        "boshqa"
      ],
      default: "davolanish"
    },
    isCleaned: {
      type: Boolean,
      default: false
    },
    // Har bir joy holatini alohida ko'rsatish
    beds: {
      type: [
        {
          status: {
            type: String,
            enum: ["bo'sh", "band", "toza emas", "toza"],
            default: "bo'sh",
          },
          comment: {
            type: String,
            default: "",
          },
        },
      ],
      default: [],
    },
    nurse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admins", // User modeldan foydalansangiz
    },
    cleaner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admins", // User modeldan foydalansangiz
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admins",
    },
    capacity: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "RoomStory",
        },
      ],
      default: [],
    },
    pricePerDay: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      enum: ["luxury", "standard", "econom"],
    },
    closeRoom: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Room", roomSchema);
