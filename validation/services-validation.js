const Ajv = require("ajv");
const ajv = new Ajv({ allErrors: true });
require("ajv-errors")(ajv);
require("ajv-formats")(ajv);
const response = require("../utils/response");

const servicesValidation = (req, res, next) => {
    const schema = {
        type: "object",
        properties: {
            profession: {
                type: "string",
                minLength: 1,
                errorMessage: "Kasb nomi bo'sh bo'lmasligi kerak"
            },
            doctorId: {
                type: "string",
                pattern: "^[0-9a-fA-F]{24}$",
                errorMessage: "Doktor ID si to'g'ri MongoDB ObjectId formatida bo'lishi kerak"
            },
            services: {
                type: "array",
                minItems: 1,
                items: {
                    type: "object",
                    properties: {
                        name: {
                            type: "string",
                            minLength: 1,
                            errorMessage: "Xizmat nomi bo'sh bo'lmasligi"
                        },
                        price: {
                            type: "number",
                            minimum: 0,
                            errorMessage: "Narx 0 dan kichik bo'lmasligi kerak"
                        }
                    },
                    required: ["name", "price"],
                    additionalProperties: false,
                    errorMessage: {
                        required: {
                            name: "Xizmat nomi kiritilishi shart",
                            price: "Xizmat narxi kiritilishi shart"
                        },
                        additionalProperties: "Xizmatda faqat 'name' va 'price' bo'lishi kerak"
                    }
                },
                errorMessage: "Xizmatlar ro'yxati bo'sh bo'lmasligi kerak"
            }
        },
        required: ["profession", "services"],
        additionalProperties: false,
        errorMessage: {
            type: "Ma'lumotlar ob'ekt bo'lishi kerak",
            required: {
                profession: "Kasb nomi kiritilishi shart",
                services: "Xizmatlar ro'yxati kiritilishi shart"
            },
            additionalProperties: "Faqat 'profession', 'doctorId' va 'services' maydonlari ruxsat etiladi"
        }
    };

    const validate = ajv.compile(schema);
    const valid = validate(req.body);

    if (!valid) {
        const errors = validate.errors.map(err => ({
            field: err.instancePath.replace(/^\//, '') || err.params.missingProperty || 'unknown',
            message: err.message
        }));
        return response(res, 400, "Validatsiya xatosi", { errors });
    }

    next();
};

module.exports = servicesValidation; s