const Ajv = require("ajv");
const ajv = new Ajv({ allErrors: true });
require("ajv-errors")(ajv);
require("ajv-formats")(ajv);
const response = require("../utils/response");

const adminValidation = (req, res, next) => {
  const schema = {
    type: "object",
    properties: {
      firstName: { type: "string", minLength: 2, maxLength: 50 },
      lastName: { type: "string", minLength: 2, maxLength: 50 },
      address: { type: "string", minLength: 2, maxLength: 100 },
      login: {
        type: "string",
        minLength: 4,
        maxLength: 20,
        pattern: "^[a-zA-Z0-9]+$",
      },
      password: { type: "string", minLength: 6, maxLength: 50 },
      role: {
        type: "string",
        enum: ["reception", "director", "doctor", "nurse", "cleaner"],
      },
      permissions: {
        type: "array",
        items: { type: "string" },
        uniqueItems: true,
      },
      salary_per_month: {
        type: "number",
        minimum: 0,
      },
      specialization: {
        type: "string",
      },
      phone: {
        type: "string",
        minLength: 7,
        maxLength: 15,
      },
      roomId: {
        type: "string",
        pattern: "^[0-9a-fA-F]{24}$",
      },
      servicesId: {
        type: "string",
        pattern: "^[0-9a-fA-F]{24}$",
      },
      birthday: {
        type: "string",
        format: "date",
      },
      salary_type: {
        type: "string",
        enum: ["fixed", "percentage"],
      },
      percentage_from_admissions: {
        type: "number",
        minimum: 0,
      },
      idCardNumber: {
        type: "string",
      },
      admission_price: {
        type: "number",
        minimum: 0,
      },
    },
    required: [
      "firstName",
      "lastName",
      "address",
      "login",
      "password",
      "phone",
    ],
    additionalProperties: false,
    errorMessage: {
      required: {
        firstName: "Ism kiritish shart",
        lastName: "Familiya kiritish shart",
        address: "Manzil kiritish shart",
        login: "Login kiritish shart",
        password: "Parol kiritish shart",
        phone: "Telefon raqam kiritish shart",
      },
      properties: {
        firstName: "Ism 2-50 ta belgi oralig‘ida bo‘lishi kerak",
        lastName: "Familiya 2-50 ta belgi oralig‘ida bo‘lishi kerak",
        address: "Manzil 2-100 ta belgi oralig‘ida bo‘lishi kerak",
        login: "Login 4-20 ta belgidan iborat, faqat harflar va raqamlar",
        password: "Parol 6-50 ta belgi oralig‘ida bo‘lishi kerak",
        role: "Rol noto‘g‘ri (faqat 'reception', 'director', 'doctor', 'nurse', 'cleaner')",
        permissions:
          "Ruxsatlar ro‘yxati takrorlanmaydigan stringlardan iborat bo‘lishi kerak",
        salary_per_month: "Oylik maosh 0 dan katta yoki teng son bo‘lishi kerak",
        specialization: "Yo‘nalish noto‘g‘ri",
        phone: "Telefon raqam 7-15 ta belgi oralig‘ida bo‘lishi kerak",
        servicesId: "Services ID noto‘g‘ri (24 ta belgi ObjectId formatida)",
        birthday: "Tug‘ilgan sana noto‘g‘ri formatda (YYYY-MM-DD)",
        salary_type: "Maosh turi noto‘g‘ri (fixed yoki percentage)",
        percentage_from_admissions: "Foiz 0 dan katta yoki teng son bo‘lishi kerak",
        idCardNumber: "ID karta raqami noto‘g‘ri",
        admission_price: "Qabul narxi 0 dan katta yoki teng son bo‘lishi kerak",
        roomId: "Xonalar ro‘yxati takrorlanmaydigan stringlardan iborat bo‘lishi kerak",
      },
      additionalProperties: "Ruxsat etilmagan maydon kiritildi",
    },
  };

  const validate = ajv.compile(schema);
  const result = validate(req.body);

  if (!result) {
    const errorField =
      validate.errors[0].instancePath.replace("/", "") || "Umumiy";
    const errorMessage = validate.errors[0].message;
    return response.error(res, `${errorField} xato: ${errorMessage}`);
  }

  next();
};

module.exports = adminValidation;