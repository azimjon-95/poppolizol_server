const Ajv = require("ajv");
const ajv = new Ajv({ allErrors: true });
require("ajv-errors")(ajv);
require("ajv-formats")(ajv);
const response = require("../utils/response");

const clinicInfoValidation = (req, res, next) => {
  const schema = {
    type: "object",
    properties: {
      clinicName: { type: "string", minLength: 2, maxLength: 100 },
      address: { type: "string", minLength: 2, maxLength: 200 },
      phone: { type: "string", minLength: 7, maxLength: 20 },
      logo: { type: "string" },
      work_schedule: {
        type: "object",
        properties: {
          start_time: { type: "string", pattern: "^([0-1][0-9]|2[0-3]):[0-5][0-9]$", minLength: 5, maxLength: 5 },
          end_time: { type: "string", pattern: "^([0-1][0-9]|2[0-3]):[0-5][0-9]$", minLength: 5, maxLength: 5 },
          work_days: {
            type: "array",
            items: { type: "string", enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] },
          },
          lunch_break: {
            type: "object",
            properties: {
              start_time: { type: "string", pattern: "^([0-1][0-9]|2[0-3]):[0-5][0-9]$", minLength: 5, maxLength: 5 },
              end_time: { type: "string", pattern: "^([0-1][0-9]|2[0-3]):[0-5][0-9]$", minLength: 5, maxLength: 5 },
              enabled: { type: "boolean" },
            },
            additionalProperties: false,
          },
        },
        required: ["start_time", "end_time"],
        additionalProperties: false,
      },
    },
    required: ["clinicName", "address", "phone", "work_schedule"],
    additionalProperties: false,
    errorMessage: {
      required: {
        clinicName: "Klinika nomi kiritish shart",
        address: "Manzil kiritish shart",
        phone: "Telefon raqam kiritish shart",
        work_schedule: "Ish vaqti sozlamalari kiritish shart",
        "work_schedule.start_time": "Ish boshlanish vaqti kiritish shart",
        "work_schedule.end_time": "Ish tugash vaqti kiritish shart",
      },
      properties: {
        clinicName: "Klinika nomi 2-100 ta belgi oralig‘ida bo‘lishi kerak",
        address: "Manzil 2-200 ta belgi oralig‘ida bo‘lishi kerak",
        phone: "Telefon raqam 7-20 ta belgi oralig‘ida bo‘lishi kerak",
        "work_schedule.start_time": "Ish boshlanish vaqti noto‘g‘ri formatda (HH:mm)",
        "work_schedule.end_time": "Ish tugash vaqti noto‘g‘ri formatda (HH:mm)",
        "work_schedule.work_days": "Ish kunlari noto‘g‘ri formatda",
        "work_schedule.lunch_break.start_time": "Tushlik vaqti boshlanishi noto‘g‘ri formatda (HH:mm)",
        "work_schedule.lunch_break.end_time": "Tushlik vaqti tugashi noto‘g‘ri formatda (HH:mm)",
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

module.exports = clinicInfoValidation;