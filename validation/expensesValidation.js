const Ajv = require("ajv");
const ajv = new Ajv({ allErrors: true });
require("ajv-errors")(ajv);
require("ajv-formats")(ajv);
const response = require("../utils/response");

const expenseValidation = (req, res, next) => {
  const schema = {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1, maxLength: 100 },
      amount: { type: "number", minimum: 0 },
      type: { type: "string", enum: ["kirim", "chiqim"] },
      category: { type: "string", minLength: 1, maxLength: 100 },
      description: { type: "string", maxLength: 500 },
      paymentType: { type: "string", enum: ["naqt", "karta"] },
      relevantId: { type: "string", minLength: 12, maxLength: 40 }, // ObjectId string
    },
    required: ["name", "amount", "type", "category"],
    additionalProperties: false,
    errorMessage: {
      required: {
        name: "Nomi kiritish shart",
        amount: "Summani kiritish shart",
        type: "Turi kiritish shart",
        category: "Kategoriya kiritish shart",
      },
      properties: {
        name: "Nomi 1-100 ta belgi oralig'ida bo'lishi kerak",
        amount: "Summasi 0 yoki undan katta bo'lishi kerak",
        type: "Turi faqat 'kirim' yoki 'chiqim' bo'lishi kerak",
        category: "Kategoriya 1-100 ta belgi oralig'ida bo'lishi kerak",
        description: "Izoh 500 belgidan oshmasligi kerak",
        paymentType: "To'lov turi faqat 'naqt' yoki 'karta' bo'lishi kerak",
        relevantId: "relevantId noto'g'ri formatda",
      },
      additionalProperties: "Ruxsat etilmagan maydon kiritildi",
    },
  };

  const validate = ajv.compile(schema);
  const result = validate(req.body);

  if (!result) {
    let errorField =
      validate.errors[0].instancePath.replace("/", "") || "Umumiy";
    let errorMessage = validate.errors[0].message;
    return response.error(res, `${errorField} xato: ${errorMessage}`);
  }
  next();
};

module.exports = expenseValidation;
