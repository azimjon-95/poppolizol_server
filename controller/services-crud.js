const response = require('../utils/response');
const Services = require('../model/servicesModel');

class ServicesController {
    // CREATE - Yangi xizmat qo'shish
    async create(req, res) {
        try {
            const service = new Services(req.body);
            await service.save();
            return response.created(res, "Xizmat muvaffaqiyatli yaratildi", service);
        } catch (error) {
            return response.error(res, "Xizmat yaratishda xatolik", error.message);
        }
    }

    // READ - Barcha xizmatlarni olish
    async getAll(req, res) {
        try {
            const services = await Services.find().populate('doctorId');
            return response.success(res, "Xizmatlar ro'yxati", services);
        } catch (error) {
            return response.serverError(res, "Server xatosi", error.message);
        }
    }

    // READ - Bitta xizmat olish
    async getById(req, res) {
        try {
            const service = await Services.findById(req.params.id).populate('doctorId', 'name');
            if (!service) {
                return response.notFound(res, "Xizmat topilmadi");
            }
            return response.success(res, "Xizmat ma'lumotlari", service);
        } catch (error) {
            return response.error(res, "Xizmat olishda xatolik", error.message);
        }
    }

    // UPDATE - Xizmat ma'lumotlarini yangilash
    async update(req, res) {
        try {
            const service = await Services.findByIdAndUpdate(
                req.params.id,
                req.body,
                { new: true, runValidators: true }
            );
            if (!service) {
                return response.notFound(res, "Xizmat topilmadi");
            }
            return response.success(res, "Xizmat muvaffaqiyatli yangilandi", service);
        } catch (error) {
            return response.error(res, "Xizmat yangilashda xatolik", error.message);
        }
    }

    // DELETE - Xizmat o'chirish
    async delete(req, res) {
        try {
            const service = await Services.findByIdAndDelete(req.params.id);
            if (!service) {
                return response.notFound(res, "Xizmat topilmadi");
            }
            return response.success(res, "Xizmat muvaffaqiyatli o'chirildi");
        } catch (error) {
            return response.error(res, "Xizmat o'chirishda xatolik", error.message);
        }
    }

    // ADD - Xizmatlar arrayiga yangi xizmat qo'shish
    async addService(req, res) {
        try {
            const { name, price } = req.body;
            if (!name || !price) {
                return response.error(res, "Xizmat nomi va narxi kiritilishi shart");
            }

            const service = await Services.findById(req.params.id);
            if (!service) {
                return response.notFound(res, "Xizmat topilmadi");
            }

            service.services.push({ name, price });
            await service.save();
            return response.success(res, "Yangi xizmat qo'shildi", service);
        } catch (error) {
            return response.error(res, "Xizmat qo'shishda xatolik", error.message);
        }
    }

    // DELETE - Xizmatlar arrayidan xizmat o'chirish
    async deleteService(req, res) {
        try {
            const { serviceId } = req.body;
            if (!serviceId) {
                return response.error(res, "O'chiriladigan xizmat ID si kiritilishi shart");
            }

            const service = await Services.findById(req.params.id);
            if (!service) {
                return response.notFound(res, "Xizmat topilmadi");
            }

            const serviceIndex = service.services.findIndex(s => s._id.toString() === serviceId);
            if (serviceIndex === -1) {
                return response.notFound(res, "Xizmat ro'yxatda topilmadi");
            }

            service.services.splice(serviceIndex, 1);
            await service.save();
            return response.success(res, "Xizmat ro'yxatdan o'chirildi", service);
        } catch (error) {
            return response.error(res, "Xizmat o'chirishda xatolik", error.message);
        }
    }
}

module.exports = new ServicesController();