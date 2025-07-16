// const Ajv = require("ajv");
// const ajv = new Ajv({ allErrors: true, verbose: true });
// require("ajv-errors")(ajv);
// require("ajv-formats")(ajv);
// const response = require("../utils/response");

// const employeeValidation = (req, res, next) => {
//   const schema = {
//     type: "object",
//     properties: {
//       firstName: {
//         type: "string",
//         minLength: 2,
//         maxLength: 50,
//         errorMessage: "Ism 2-50 ta belgi oralig‘ida bo‘lishi kerak",
//       },
//       middleName: {
//         type: "string",
//         maxLength: 50,
//         errorMessage: "Otasining ismi 50 ta belgi oralig‘ida bo‘lishi kerak",
//       },
//       lastName: {
//         type: "string",
//         minLength: 2,
//         maxLength: 50,
//         errorMessage: "Familya 2-50 ta belgi oralig‘ida bo‘lishi kerak",
//       },
//       department: {
//         type: "string",
//         enum: [
//           "ishlab_chiqarish",
//           "sifat_nazorati",
//           "saler_meneger",
//           "ombor",
//           "buxgalteriya",
//           "elektrik",
//           "transport",
//           "xavfsizlik",
//           "tozalash",
//           "Sotuvchi",
//           "oshxona",
//         ],
//         errorMessage: "Bo‘lim noto‘g‘ri (mavjud bo‘limlardan birini tanlang)",
//       },
//       position: {
//         type: "string",
//         minLength: 2,
//         maxLength: 100,
//         errorMessage: "Lavozim 2-100 ta belgi oralig‘ida bo‘lishi kerak",
//       },
//       experience: {
//         type: "string",
//         maxLength: 50,
//         errorMessage: "Ish staji 50 ta belgi oralig‘ida bo‘lishi kerak",
//       },
//       passportSeries: {
//         type: "string",
//         pattern: "^[A-Z]{2}\\d{7}$",
//         errorMessage: "Pasport seriyasi formati noto‘g‘ri (masalan, AA1234567)",
//       },
//       phone: {
//         type: "string",
//         pattern: "^\\+998\\d{9}$",
//         errorMessage:
//           "Telefon raqami formati noto‘g‘ri (masalan, +998901234567)",
//       },
//       address: {
//         type: "string",
//         minLength: 2,
//         maxLength: 100,
//         errorMessage: "Manzil 2-100 ta belgi oralig‘ida bo‘lishi kerak",
//       },
//       paymentType: {
//         type: "string",
//         enum: ["oylik", "kunlik", "soatlik", "ishbay"],
//         errorMessage:
//           "To‘lov turi noto‘g‘ri (oylik, kunlik, soatlik, yoki ishbay)",
//       },
//       salary: {
//         type: "number",
//         minimum: 0,
//         errorMessage: "Maosh 0 dan katta yoki teng son bo‘lishi kerak",
//       },
//       isOfficeWorker: {
//         type: "boolean",
//         errorMessage: "Ofis xodimi holati boolean bo‘lishi kerak",
//       },
//       login: {
//         type: "string",
//       },
//       password: {
//         type: "string",
//       },
//       // role: {
//       //   type: "string",
//       //   enum: [
//       //     "director",
//       //     "admin",
//       //     "manager",
//       //     "specialist",
//       //     "warehouse",
//       //     "accountant",
//       //     "saler",
//       //   ],
//       //   errorMessage:
//       //     "Rol noto‘g‘ri (admin, manager, specialist, warehouse, accountant yoki bo‘sh)",
//       // },
//       unit: {
//         type: "string",
//         enum: ["polizol", "rubiroid", "ochisleniya", "boshqa"],
//       },
//       unitHeadPassword: {
//         type: "string",
//       },
//     },
//     required: [
//       "firstName",
//       "lastName",
//       "department",
//       "position",
//       "passportSeries",
//       "phone",
//       "address",
//       "paymentType",
//       "unit",
//     ],
//     if: { properties: { isOfficeWorker: { const: true } } },
//     then: {
//       required: ["login", "password", "role"],
//       properties: {
//         role: {
//           type: "string",
//           enum: [
//             "director",
//             "admin",
//             "manager",
//             "specialist",
//             "warehouse",
//             "accountant",
//             "saler",
//           ],
//           errorMessage:
//             "Rol noto‘g‘ri (admin, manager, specialist, warehouse, accountant yoki bo‘sh)",
//         },
//         // login, password uchun ham shunga o‘xshash
//       },
//     },
//     else: {
//       properties: {
//         role: {
//           type: "string",
//           enum: [""],
//           errorMessage: "Rol majburiy emas, faqat bo‘sh bo‘lishi mumkin",
//         },
//         login: { type: "string", enum: [""] },
//         password: { type: "string", enum: [""] },
//       },
//     },
//     additionalProperties: false,
//     errorMessage: {
//       required: {
//         firstName: "Ism kiritish shart",
//         lastName: "Familya kiritish shart",
//         department: "Bo‘lim kiritish shart",
//         position: "Lavozim kiritish shart",
//         passportSeries: "Pasport seriyasi kiritish shart",
//         phone: "Telefon raqam kiritish shart",
//         address: "Manzil kiritish shart",
//         paymentType: "To‘lov turi kiritish shart",
//         salary: "Maosh kiritish shart",
//         unit: "Bo‘lim kiritish shart",
//         unitHeadPassword: "Bo‘lim boshlig‘ining paroli kiritish shart",
//       },
//       additionalProperties: "Ruxsat etilmagan maydon kiritildi",
//     },
//   };

//   const validate = ajv.compile(schema);
//   const valid = validate(req.body);

//   if (!valid) {
//     const error = validate.errors[0];
//     const errorField = error.instancePath.replace("/", "") || "Umumiy";
//     const errorMessage = error.message || error.params.message;
//     return response.error(res, `${errorField}: ${errorMessage}`);
//   }

//   next();
// };

// module.exports = employeeValidation;

const Ajv = require("ajv");
const ajv = new Ajv({ allErrors: true, verbose: true });
require("ajv-errors")(ajv);
require("ajv-formats")(ajv);
const response = require("../utils/response");

const employeeValidation = (req, res, next) => {
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
      department: {
        type: "string",
        enum: [
          "ishlab_chiqarish",
          "sifat_nazorati",
          "saler_meneger",
          "ombor",
          "buxgalteriya",
          "elektrik",
          "transport",
          "xavfsizlik",
          "tozalash",
          "Sotuvchi",
          "oshxona",
          
        ],
        errorMessage: "Bo‘lim noto‘g‘ri (mavjud bo‘limlardan birini tanlang)",
      },
      position: {
        type: "string",
        minLength: 2,
        maxLength: 100,
        errorMessage: "Lavozim 2-100 ta belgi oralig‘ida bo‘lishi kerak",
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
        errorMessage:
          "Telefon raqami formati noto‘g‘ri (masalan, +998901234567)",
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
        errorMessage:
          "To‘lov turi noto‘g‘ri (oylik, kunlik, soatlik, yoki ishbay)",
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
      login: { type: "string" }, // har doim schema-da bor, lekin majburiy emas
      password: { type: "string" }, // har doim schema-da bor, lekin majburiy emas
      role: { type: "string" }, // har doim schema-da bor, lekin majburiy emas
      unit: {
        type: "string",
        enum: ["polizol", "rubiroid", "ochisleniya", "boshqa"],
      },
      unitHeadPassword: { type: "string" },
    },
    required: [
      "firstName",
      "lastName",
      "department",
      "position",
      "passportSeries",
      "phone",
      "address",
      "paymentType",
      "unit",
    ],
    if: { properties: { isOfficeWorker: { const: true } } },
    then: {
      required: ["login", "password", "role"],
      properties: {
        login: {
          type: "string",
          minLength: 4,
          maxLength: 20,
          pattern: "^[a-zA-Z0-9]+$",
          errorMessage:
            "Login 4-20 ta belgidan iborat, faqat harflar va raqamlar",
        },
        password: {
          type: "string",
          minLength: 6,
          maxLength: 50,
          errorMessage: "Parol 6-50 ta belgi oralig‘ida bo‘lishi kerak",
        },
        role: {
          type: "string",
          enum: [
            "director",
            "admin",
            "manager",
            "specialist",
            "warehouse",
            "accountant",
            "saler",
            "unit_head",
          ],
          errorMessage:
            "Rol noto‘g‘ri (admin, manager, specialist, warehouse, accountant yoki bo‘sh)",
        },
      },
    },
    else: {
      properties: {
        login: { type: "string", enum: [""] },
        password: { type: "string", enum: [""] },
        role: { type: "string", enum: [""] },
      },
    },
    additionalProperties: false,
    errorMessage: {
      required: {
        firstName: "Ism kiritish shart",
        lastName: "Familya kiritish shart",
        department: "Bo‘lim kiritish shart",
        position: "Lavozim kiritish shart",
        passportSeries: "Pasport seriyasi kiritish shart",
        phone: "Telefon raqam kiritish shart",
        address: "Manzil kiritish shart",
        paymentType: "To‘lov turi kiritish shart",
        salary: "Maosh kiritish shart",
        unit: "Bo‘lim kiritish shart",
        unitHeadPassword: "Bo‘lim boshlig‘ining paroli kiritish shart",
      },
      additionalProperties: "Ruxsat etilmagan maydon kiritildi",
    },
  };

  const validate = ajv.compile(schema);
  const valid = validate(req.body);

  if (!valid) {
    const error = validate.errors[0];
    const errorField = error.instancePath.replace("/", "") || "Umumiy";
    const errorMessage = error.message || error.params.message;
    return response.error(res, `${errorField}: ${errorMessage}`);
  }

  next();
};

module.exports = employeeValidation;
