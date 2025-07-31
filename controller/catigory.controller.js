const { Product } = require('../model/factoryModel');
const response = require('../utils/response'); // Sizning yozgan response classingiz

class CategoryProductController {
    // Yangi mahsulot yaratish
    async create(req, res) {
        try {
            const { name, category, productionCost, loadingCost } = req.body;

            const existing = await Product.findOne({ name });
            if (existing) {
                return response.warning(res, "Bunday nomdagi mahsulot allaqachon mavjud");
            }

            const product = await Product.create({ name, category, productionCost, loadingCost });
            return response.created(res, "Mahsulot yaratildi", product);
        } catch (error) {
            console.error("Create Error:", error);
            return response.serverError(res, "Mahsulot yaratishda xatolik", error.message);
        }
    }

    // Barcha mahsulotlarni olish
    async getAll(req, res) {
        try {
            const products = await Product.find().sort({ createdAt: -1 });
            return response.success(res, "Mahsulotlar ro'yxati", products);
        } catch (error) {
            console.error("Get All Error:", error);
            return response.serverError(res, "Mahsulotlarni olishda xatolik", error.message);
        }
    }

    // Bitta mahsulotni olish
    async getById(req, res) {
        try {
            const { id } = req.params;
            const product = await Product.findById(id);

            if (!product) {
                return response.notFound(res, "Mahsulot topilmadi");
            }

            return response.success(res, "Mahsulot topildi", product);
        } catch (error) {
            console.error("Get By ID Error:", error);
            return response.serverError(res, "Mahsulotni olishda xatolik", error.message);
        }
    }

    // Mahsulotni yangilash
    async update(req, res) {
        try {
            const { id } = req.params;
            const updatedData = req.body;

            const product = await Product.findByIdAndUpdate(id, updatedData, { new: true });

            if (!product) {
                return response.notFound(res, "Yangilash uchun mahsulot topilmadi");
            }

            return response.success(res, "Mahsulot yangilandi", product);
        } catch (error) {
            console.error("Update Error:", error);
            return response.serverError(res, "Mahsulotni yangilashda xatolik", error.message);
        }
    }

    // Mahsulotni o'chirish
    async delete(req, res) {
        try {
            const { id } = req.params;

            const product = await Product.findByIdAndDelete(id);

            if (!product) {
                return response.notFound(res, "O'chirish uchun mahsulot topilmadi");
            }

            return response.success(res, "Mahsulot o'chirildi", product);
        } catch (error) {
            console.error("Delete Error:", error);
            return response.serverError(res, "Mahsulotni o'chirishda xatolik", error.message);
        }
    }
}

module.exports = new CategoryProductController();
