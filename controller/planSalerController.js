const mongoose = require("mongoose");
const Employee = require("../model/adminModel");
const Plan = require("../model/planSalerModel");
const response = require("../utils/response");

class SalesController {
    // Get all sales employees
    async getSalesEmployees(req, res) {
        try {
            const salesEmployees = await Employee.find({
                unit: { $in: ["sotuvchi", "sotuvchi eksport", "sotuvchi menejir"] },
            })
                .select("firstName lastName unit role phone")
                .lean();

            return response.success(res, "Sotuvchilar muvaffaqiyatli olindi", salesEmployees);
        } catch (error) {
            console.error("Get sales employees error:", error);
            return response.serverError(res, "Xodimlarni olishda server xatosi", error);
        }
    }

    // Create a new plan
    async createPlan(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { employeeId, targetAmount, month } = req.body;

            // Validate input
            if (!employeeId || !targetAmount || !month) {
                await session.abortTransaction();
                return response.error(res, "Barcha maydonlar to'ldirilishi shart");
            }

            if (!mongoose.Types.ObjectId.isValid(employeeId)) {
                await session.abortTransaction();
                return response.error(res, "Noto'g'ri employeeId");
            }

            if (typeof targetAmount !== "number" || targetAmount <= 0) {
                await session.abortTransaction();
                return response.error(res, "Target summasi musbat son bo'lishi kerak");
            }

            // Verify employee exists and is a sales employee
            const employee = await Employee.findOne({
                _id: employeeId,
                unit: { $in: ["sotuvchi", "sotuvchi eksport", "sotuvchi menejir"] },
            })
                .select("-password -unitHeadPassword")
                .session(session);

            if (!employee) {
                await session.abortTransaction();
                return response.notFound(res, "Sotuvchi topilmadi yoki bo'lim noto'g'ri");
            }

            // Check if plan already exists for this month
            const existingPlan = await Plan.findOne({
                employeeId,
                month,
            }).session(session);

            if (existingPlan) {
                await session.abortTransaction();
                return response.error(res, "Bu oy uchun plan allaqachon mavjud");
            }

            // Create new plan
            const newPlan = new Plan({
                employeeId,
                month,
                targetAmount,
                achievedAmount: 0,
                progress: 0,
            });

            // Save plan
            const savedPlan = await newPlan.save({ session });

            // Update employee's plans array
            await Employee.findByIdAndUpdate(
                employeeId,
                { $push: { plans: savedPlan._id } },
                { session }
            );

            await session.commitTransaction();

            // Populate employee data in response
            const populatedPlan = await Plan.findById(savedPlan._id)
                .populate("employeeId", "firstName lastName unit role")
                .lean();

            return response.created(res, "Plan muvaffaqiyatli yaratildi", populatedPlan);
        } catch (error) {
            await session.abortTransaction();
            console.error("Create plan error:", error);
            return response.serverError(res, "Plan yaratishda server xatosi", error);
        } finally {
            session.endSession();
        }
    }

    // Get all plans with populated employee data
    async getAllPlans(req, res) {
        try {
            const plans = await Plan.find()
                .populate("employeeId", "firstName lastName unit role")
                .lean();

            return response.success(res, "Planlar muvaffaqiyatli olindi", plans);
        } catch (error) {
            console.error("Get all plans error:", error);
            return response.serverError(res, "Planlarni olishda server xatosi", error);
        }
    }

    // Get plan by ID with populated employee data
    async getPlanById(req, res) {
        try {
            if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
                return response.error(res, "Noto'g'ri plan ID");
            }

            const plan = await Plan.findById(req.params.id)
                .populate("employeeId", "firstName lastName unit role")
                .lean();

            if (!plan) {
                return response.notFound(res, "Plan topilmadi");
            }

            return response.success(res, "Plan muvaffaqiyatli olindi", plan);
        } catch (error) {
            console.error("Get plan by ID error:", error);
            return response.serverError(res, "Plan olishda server xatosi", error);
        }
    }

    // Update plan
    async updatePlan(req, res) {
        try {
            const { targetAmount, month } = req.body;

            if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
                return response.error(res, "Noto'g'ri plan ID");
            }

            if (targetAmount && (typeof targetAmount !== "number" || targetAmount <= 0)) {
                return response.error(res, "Target summasi musbat son bo'lishi kerak");
            }

            if (!month) {
                return response.error(res, "Oy kiritilishi shart");
            }

            const plan = await Plan.findById(req.params.id);
            if (!plan) {
                return response.notFound(res, "Plan topilmadi");
            }

            const updatedPlan = await Plan.findByIdAndUpdate(
                req.params.id,
                { $set: { targetAmount, month } },
                { new: true, runValidators: true }
            )
                .populate("employeeId", "firstName lastName unit role")
                .lean();

            return response.success(res, "Plan muvaffaqiyatli yangilandi", updatedPlan);
        } catch (error) {
            console.error("Update plan error:", error);
            return response.serverError(res, "Plan yangilashda server xatosi", error);
        }
    }

    // Delete plan
    async deletePlan(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
                await session.abortTransaction();
                return response.error(res, "Noto'g'ri plan ID");
            }

            const plan = await Plan.findById(req.params.id).session(session);
            if (!plan) {
                await session.abortTransaction();
                return response.notFound(res, "Plan topilmadi");
            }

            // Remove plan reference from employee
            await Employee.findByIdAndUpdate(
                plan.employeeId,
                { $pull: { plans: plan._id } },
                { session }
            );

            // Delete plan
            await Plan.findByIdAndDelete(req.params.id).session(session);

            await session.commitTransaction();

            return response.success(res, "Plan muvaffaqiyatli o'chirildi");
        } catch (error) {
            await session.abortTransaction();
            console.error("Delete plan error:", error);
            return response.serverError(res, "Plan o'chirishda server xatosi", error);
        } finally {
            session.endSession();
        }
    }
}

module.exports = new SalesController();






// const mongoose = require('mongoose');
// const Employee = require('../model/adminModel');
// const Plan = require('../model/planSalerModel');
// const response = require('../utils/response');

// class SalesController {
//     // Get all sales employees
//     async getSalesEmployees(req, res) {
//         try {
//             const salesEmployees = await Employee.find({ role: { $in: ['saler', 'saler_meneger'] } })
//                 .select('firstName lastName unit position phone department')
//                 .lean();

//             return response.success(res, "Sotuvchilar muvaffaqiyatli olindi", salesEmployees);
//         } catch (error) {
//             return response.serverError(res, "Xodimlarni olishda server xatosi", error.message);
//         }
//     }

//     // Create a new plan
//     async createPlan(req, res) {
//         const session = await mongoose.startSession();
//         session.startTransaction();

//         try {
//             const { employeeId, targetAmount, month } = req.body;

//             // Validate input
//             if (!employeeId || !targetAmount || !month) {
//                 await session.abortTransaction();
//                 return response.error(res, "Barcha maydonlar to'ldirilishi shart");
//             }

//             // Verify employee exists and is either 'saler' or 'saler_meneger'
//             const employee = await Employee.findOne({
//                 _id: employeeId,
//                 role: { $in: ['saler', 'saler_meneger'] }
//             }).session(session);

//             if (!employee) {
//                 await session.abortTransaction();
//                 return response.notFound(res, "Sotuvchi topilmadi yoki role noto'g'ri");
//             }

//             // Check if plan already exists for this month
//             const existingPlan = await Plan.findOne({
//                 employeeId,
//                 month
//             }).session(session);

//             if (existingPlan) {
//                 await session.abortTransaction();
//                 return response.error(res, "Bu oy uchun plan allaqachon mavjud");
//             }

//             // Create new plan
//             const newPlan = new Plan({
//                 employeeId,
//                 month,
//                 targetAmount,
//                 achievedAmount: 0,
//                 progress: 0
//             });

//             // Save plan
//             const savedPlan = await newPlan.save({ session });

//             // Update employee's plans array
//             await Employee.findByIdAndUpdate(
//                 employeeId,
//                 { $push: { plans: savedPlan._id } },
//                 { session }
//             );

//             await session.commitTransaction();

//             // Populate employee data in response
//             const populatedPlan = await Plan.findById(savedPlan._id)
//                 .populate('employeeId', 'firstName lastName')
//                 .lean();

//             return response.created(res, "Plan muvaffaqiyatli yaratildi", populatedPlan);
//         } catch (error) {
//             await session.abortTransaction();
//             return response.serverError(res, "Plan yaratishda server xatosi", error.message);
//         } finally {
//             session.endSession();
//         }
//     }

//     // Get all plans with populated employee data
//     async getAllPlans(req, res) {
//         try {
//             const plans = await Plan.find()
//                 .populate('employeeId', 'firstName lastName unit position')
//                 .lean();

//             return response.success(res, "Planlar muvaffaqiyatli olindi", plans);
//         } catch (error) {
//             return response.serverError(res, "Planlarni olishda server xatosi", error.message);
//         }
//     }

//     // Get plan by ID with populated employee data
//     async getPlanById(req, res) {
//         try {
//             const plan = await Plan.findById(req.params.id)
//                 .populate('employeeId', 'firstName lastName unit position')
//                 .lean();

//             if (!plan) {
//                 return response.notFound(res, "Plan topilmadi");
//             }

//             return response.success(res, "Plan muvaffaqiyatli olindi", plan);
//         } catch (error) {
//             return response.serverError(res, "Plan olishda server xatosi", error.message);
//         }
//     }

//     // Update plan
//     async updatePlan(req, res) {
//         try {
//             const { targetAmount, month } = req.body;

//             const plan = await Plan.findById(req.params.id);
//             if (!plan) {
//                 return response.notFound(res, "Plan topilmadi");
//             }

//             const updatedPlan = await Plan.findByIdAndUpdate(
//                 req.params.id,
//                 { $set: { targetAmount, month } },
//                 { new: true, runValidators: true }
//             )
//                 .populate('employeeId', 'firstName lastName')
//                 .lean();

//             return response.success(res, "Plan muvaffaqiyatli yangilandi", updatedPlan);
//         } catch (error) {
//             return response.serverError(res, "Plan yangilashda server xatosi", error.message);
//         }
//     }

//     // Delete plan
//     async deletePlan(req, res) {
//         const session = await mongoose.startSession();
//         session.startTransaction();

//         try {
//             const plan = await Plan.findById(req.params.id).session(session);
//             if (!plan) {
//                 await session.abortTransaction();
//                 return response.notFound(res, "Plan topilmadi");
//             }

//             // Remove plan reference from employee
//             await Employee.findByIdAndUpdate(
//                 plan.employeeId,
//                 { $pull: { plans: plan._id } },
//                 { session }
//             );

//             // Delete plan
//             await Plan.findByIdAndDelete(req.params.id).session(session);

//             await session.commitTransaction();

//             return response.success(res, "Plan muvaffaqiyatli o'chirildi");
//         } catch (error) {
//             await session.abortTransaction();
//             return response.serverError(res, "Plan o'chirishda server xatosi", error.message);
//         } finally {
//             session.endSession();
//         }
//     }
// }

// module.exports = new SalesController();


