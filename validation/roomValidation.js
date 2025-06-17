const Ajv = require("ajv");
const ajv = new Ajv({ allErrors: true });
require("ajv-errors")(ajv);
require("ajv-formats")(ajv);
const response = require("../utils/response");

const roomValidation = (req, res, next) => {
  const schema = {
    type: "object",
    properties: {
      name: {
        type: "string",
        maxLength: 255,
      },
      roomNumber: {
        type: "number",
        minimum: 1, // Assuming roomNumber should be positive
      },
      floor: {
        type: "number",
        minimum: 0,
      },
      usersNumber: {
        type: "number",
        minimum: 0,
      },
      roomType: {
        type: "string",
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
          "boshqa",
        ],
        default: "davolanish",
      },
      isCleaned: {
        type: "boolean"
      },
      beds: {
        type: "array",
        items: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["bo'sh", "band", "toza emas", "toza"],
              default: "bo'sh",
            },
            comment: {
              type: "string",
              maxLength: 500,
              default: "",
            },
          },
          required: ["status"],
          additionalProperties: false,
        },
        default: [],
      },
      nurse: {
        type: ["string", "null"], // Allow null since it's optional in roomSchema
        pattern: "^[0-9a-fA-F]{24}$",
      },
      cleaner: {
        type: ["string", "null"], // Allow null since it's optional in roomSchema
        pattern: "^[0-9a-fA-F]{24}$",
      },
      doctorId: {
        type: ["string", "null"], // Allow null since it's optional in roomSchema
        pattern: "^[0-9a-fA-F]{24}$",
      },
      capacity: {
        type: "array",
        items: {
          type: "string",
          pattern: "^[0-9a-fA-F]{24}$",
        },
        default: [],
      },
      pricePerDay: {
        type: "number",
        minimum: 0, // Assuming price should be non-negative
      },
      category: {
        type: "string",
        enum: ["luxury", "standard", "econom"],
      },
      closeRoom: {
        type: "boolean",
        default: false,
      },
    },
    required: ["floor", "usersNumber", "pricePerDay"],
    additionalProperties: false,
    errorMessage: {
      required: {
        floor: "Qavat kiritish shart",
        usersNumber: "Foydalanuvchilar soni kiritish shart",
        pricePerDay: "Kunlik narx kiritish shart",
      },
      properties: {
        name: "Noto‘g‘ri xona nomi",
        roomNumber: "Xona raqami musbat son bo'lishi kerak",
        floor: "Qavat 0 yoki undan yuqori son bo'lishi kerak",
        usersNumber: "Foydalanuvchilar soni musbat son bo'lishi kerak",
        roomType: "Xona turi noto'g'ri kiritilgan",
        beds: "Yotoqlar ro'yxati noto'g'ri formatda",
        "beds/status": "Yotoq holati faqat Bo'sh, Band, Toza emas yoki Toza bo'lishi mumkin",
        "beds/comment": "Izoh 500 belgidan oshmasligi kerak",
        nurse: "Hamshira ID si noto'g'ri formatda",
        cleaner: "Tozalovchi ID si noto'g'ri formatda",
        doctorId: "Shifokor ID si noto'g'ri formatda",
        capacity: "Xona tarixi ID lari noto'g'ri formatda",
        pricePerDay: "Kunlik narx musbat son bo'lishi kerak",
        category: "Kategoriya faqat luxury, standard yoki econom bo'lishi mumkin",
        closeRoom: "Xona yopiq holati boolean bo'lishi kerak",
        isCleaned: "Tozalangan holati boolean (true yoki false) bo'lishi kerak",
      },
      additionalProperties: "Ruxsat etilmagan maydon kiritildi",
    },
  };

  const validate = ajv.compile(schema);
  const result = validate(req.body);

  if (!result) {
    let errorField = validate.errors[0].instancePath.replace("/", "") || "Umumiy";
    let errorMessage = validate.errors[0].message;
    return response.error(res, `${errorField} xato: ${errorMessage}`);
  }
  next();
};

module.exports = roomValidation;