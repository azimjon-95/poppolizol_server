const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const addErrors = require("ajv-errors");
const mongoose = require("mongoose");
const response = require("../utils/response");

const employeeValidation = (req, res, next) => {
  const ajv = new Ajv({ allErrors: true, verbose: true });
  addFormats(ajv);
  addErrors(ajv);

  // Add custom ObjectId format
  ajv.addFormat("objectId", {
    type: "string",
    validate: (value) => mongoose.isValidObjectId(value),
  });

  const schema = {
    type: "object",
    properties: {
      firstName: {
        type: "string",
        minLength: 2,
        maxLength: 50,
        errorMessage: "Ism 2-50 ta belgi oralig‘ida bo‘lishi kerak",
      },
      middleName: {
        type: "string",
        maxLength: 50,
        errorMessage: "Otasining ismi 50 ta belgi oralig‘ida bo‘lishi kerak",
      },
      lastName: {
        type: "string",
        minLength: 2,
        maxLength: 50,
        errorMessage: "Familya 2-50 ta belgi oralig‘ida bo‘lishi kerak",
      },
      experience: {
        type: "string",
        maxLength: 50,
        errorMessage: "Ish staji 50 ta belgi oralig‘ida bo‘lishi kerak",
      },
      passportSeries: {
        type: "string",
        pattern: "^[A-Z]{2}\\d{7}$",
        errorMessage: "Pasport seriyasi formati noto‘g‘ri (masalan, AA1234567)",
      },
      phone: {
        type: "string",
        pattern: "^\\+998\\d{9}$",
        errorMessage: "Telefon raqami formati noto‘g‘ri (masalan, +998901234567)",
      },
      address: {
        type: "string",
        minLength: 2,
        maxLength: 100,
        errorMessage: "Manzil 2-100 ta belgi oralig‘ida bo‘lishi kerak",
      },
      paymentType: {
        type: "string",
        enum: ["oylik", "kunlik", "soatlik", "ishbay"],
        errorMessage: "To‘lov turi noto‘g‘ri (oylik, kunlik, soatlik, yoki ishbay)",
      },
      salary: {
        type: "number",
        minimum: 0,
        errorMessage: "Maosh 0 dan katta yoki teng son bo‘lishi kerak",
      },
      isOfficeWorker: {
        type: "boolean",
        errorMessage: "Ofis xodimi holati boolean bo‘lishi kerak",
      },
      login: {
        type: "string",
        maxLength: 50, // Added to prevent excessively long inputs
      },
      password: {
        type: "string",
        maxLength: 50, // Added to prevent excessively long inputs
      },
      plans: {
        type: "array",
        items: { type: "string", format: "objectId" },
        errorMessage: "Rejalar massivi bo‘lib, har bir element valid ObjectId bo‘lishi kerak",
      },
      role: {
        type: "string",
        enum: ["ofis xodimi", "ishlab chiqarish", "boshqa ishchilar"],
        errorMessage: "Rol noto‘g‘ri (ofis xodimi, ishlab chiqarish yoki boshqa ishchilar)",
      },
      unit: {
        type: "string",
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
          "Okisleniya",
          "Okisleniya ish boshqaruvchi",
          "boshqa",
        ],
        errorMessage: "Bo‘lim noto‘g‘ri (mavjud bo‘limlardan birini tanlang)",
      },
      unitHeadPassword: {
        type: "string",
        maxLength: 50, // Added to prevent excessively long inputs
      },
    },
    required: [
      "firstName",
      "lastName",
      "passportSeries",
      "phone",
      "address",
      "paymentType",
    ],
    if: {
      properties: {
        isOfficeWorker: { const: true },
      },
    },
    then: {
      required: ["login", "password", "role"],
      properties: {
        login: {
          type: "string",
          minLength: 4,
          maxLength: 20,
          pattern: "^[a-zA-Z0-9]+$",
          errorMessage: "Login 4-20 ta belgidan iborat, faqat harflar va raqamlar",
        },
        password: {
          type: "string",
          minLength: 6,
          maxLength: 50,
          errorMessage: "Parol 6-50 ta belgi oralig‘ida bo‘lishi kerak",
        },
      },
    },
    anyOf: [
      {
        properties: {
          unit: {
            enum: [
              "polizol ish boshqaruvchi",
              "rubiroid ish boshqaruvchi",
              "Okisleniya ish boshqaruvchi",
            ],
          },
        },
        required: ["unitHeadPassword"],
        properties: {
          unitHeadPassword: {
            type: "string",
            minLength: 4,
            maxLength: 6,
            errorMessage: "Bo‘lim boshlig‘ining paroli 4-6 ta belgi oralig‘ida bo‘lishi kerak",
          },
        },
      },
      {
        properties: {
          unit: {
            not: {
              enum: [
                "polizol ish boshqaruvchi",
                "rubiroid ish boshqaruvchi",
                "Okisleniya ish boshqaruvchi",
              ],
            },
          },
        },
      },
    ],
    additionalProperties: false,
    errorMessage: {
      required: {
        firstName: "Ism kiritish shart",
        lastName: "Familya kiritish shart",
        passportSeries: "Pasport seriyasi kiritish shart",
        phone: "Telefon raqam kiritish shart",
        address: "Manzil kiritish shart",
        paymentType: "To‘lov turi kiritish shart",
        login: "Login kiritish shart",
        password: "Parol kiritish shart",
        role: "Rol kiritish shart",
        unitHeadPassword: "Bo‘lim boshlig‘ining paroli kiritish shart",
      },
      additionalProperties: "Ruxsat etilmagan maydon kiritildi",
    },
  };

  const validate = ajv.compile(schema);
  const valid = validate(req.body);

  if (!valid) {
    const errorMessages = validate.errors.map((error) => {
      const errorField = error.instancePath.replace("/", "") || "Umumiy";
      return `${errorField}: ${error.message || error.params.message}`;
    });
    return response.error(res, errorMessages.join("; "));
  }

  next();
};

module.exports = employeeValidation;