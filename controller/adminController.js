const response = require("../utils/response");
const mongoose = require("mongoose");
const adminsDB = require("../model/adminModel");
const storiesDB = require("../model/storyModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

class AdminController {
  // Barcha adminlarni olish (Read - All)
  async getAdmins(req, res) {
    try {
      const admins = await adminsDB.find().select("-password").populate("roomId").populate("servicesId"); // Parolni chiqarmaslik uchun
      if (!admins.length) return response.notFound(res, "Adminlar topilmadi");
      response.success(res, "Barcha adminlar", admins);
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }

  async getAdminsForReception(req, res) {
    try {
      // Bugungi sana chegaralari
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      // Aggregation pipeline
      const result = await adminsDB.aggregate([
        // Match doctors with a valid servicesId
        {
          $match: {
            role: "doctor",
            servicesId: { $ne: null }, // Exclude admins without servicesId
          },
        },
        // Lookup Services collection to get services array
        {
          $lookup: {
            from: "services", // Collection name (lowercase, as MongoDB stores it)
            localField: "servicesId",
            foreignField: "_id",
            as: "serviceDetails",
          },
        },
        // Unwind serviceDetails to include services array
        {
          $unwind: {
            path: "$serviceDetails",
            preserveNullAndEmptyArrays: false, // Exclude if no matching service
          },
        },
        // Lookup stories for today's queue
        {
          $lookup: {
            from: "stories",
            let: { doctorId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$doctorId", "$$doctorId"] },
                      { $eq: ["$view", false] },
                      { $gte: ["$createdAt", today] },
                      { $lt: ["$createdAt", tomorrow] },
                    ],
                  },
                },
              },
            ],
            as: "todayStories",
          },
        },
        // Project required fields
        {
          $project: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            specialization: 1,
            // admission_price: 1, // Uncomment if needed
            todayQueue: { $size: "$todayStories" },
            services: "$serviceDetails.services", // Include services array
          },
        },
      ]);

      if (!result.length) {
        return response.notFound(res, "Adminlar topilmadi");
      }
      response.success(res, "Barcha adminlar", result);
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }

  async getAdminById(req, res) {
    try {
      const admin = await adminsDB.findById(req.params.id).select("-password");
      if (!admin) return response.notFound(res, "Admin topilmadi");
      response.success(res, "Admin topildi", admin);
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }

  // Yangi admin qo‘shish (Create)
  async createAdmin(req, res) {
    try {
      let io = req.app.get("socket");
      const { login, password, permissions } = req.body;

      // Login takrorlanmasligini tekshirish
      const existingAdmin = await adminsDB.findOne({ login });
      if (existingAdmin) {
        return response.error(res, "Bu login allaqachon mavjud");
      }

      // Ruxsatlarni tekshirish (agar kerak bo‘lsa)
      if (!permissions || permissions.length === 0) {
        return response.error(res, "Ruxsatlar tanlanmagan");
      }

      // Parolni shifrlash
      const hashedPassword = await bcrypt.hash(password, 10);

      // Adminni yaratish va ruxsatlar bilan saqlash
      req.body.password = hashedPassword;
      const admin = await adminsDB.create(req.body);

      // Adminni javobga tayyorlash
      const adminData = admin.toJSON();
      delete adminData.password; // Parolni javobdan olib tashlash

      // Yangi admin qo‘shilganda socket orqali xabar yuborish
      io.emit("new_admin", adminData);

      // Javob yuborish
      response.created(res, "Admin qo‘shildi", adminData);
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }

  // Adminni yangilash (Update)
  async updateAdmin(req, res) {
    try {
      let io = req.app.get("socket");
      const { login, password } = req.body;

      if (login) {
        const existingAdmin = await adminsDB.findOne({
          login,
          _id: { $ne: req.params.id },
        });
        if (existingAdmin)
          return response.error(res, "Bu login allaqachon mavjud");
      }

      const updateData = { ...req.body };
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      const updatedAdmin = await adminsDB.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      );

      if (!updatedAdmin)
        return response.error(res, "Admin yangilashda xatolik");

      const adminData = updatedAdmin.toJSON();
      delete adminData.password;

      io.emit("admin_updated", adminData);
      response.success(res, "Admin yangilandi", adminData);
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }

  // Adminni o‘chirish (Delete)
  async deleteAdmin(req, res) {
    try {
      let io = req.app.get("socket");
      const admin = await adminsDB.findByIdAndDelete(req.params.id);
      if (!admin) return response.error(res, "Admin o‘chirilmadi");

      const adminData = admin.toJSON();
      delete adminData.password;

      io.emit("admin_deleted", adminData);
      response.success(res, "Admin o‘chirildi");
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }

  // Admin kirishi (Login)
  async login(req, res) {
    try {
      const { login, password } = req.body;
      const admin = await adminsDB.findOne({ login });
      if (!admin) return response.error(res, "Login yoki parol xato");

      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) return response.error(res, "Login yoki parol xato");

      const token = jwt.sign(
        { id: admin._id, login: admin.login },
        process.env.JWT_SECRET_KEY,
        { expiresIn: "1w" }
      );

      const adminData = admin.toJSON();
      delete adminData.password;

      response.success(res, "Kirish muvaffaqiyatli", {
        admin: adminData,
        token,
      });
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }



  async updateServicesId(req, res) {
    try {
      const { id } = req.params; // Admin ID from URL params
      const { servicesId } = req.body; // New servicesId from request body

      // Validate Admin ID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return response.error(res, "Invalid Admin ID", 400);
      }

      // Validate servicesId
      if (!mongoose.Types.ObjectId.isValid(servicesId)) {
        return response.error(res, "Invalid Services ID", 400);
      }

      // Find and update the Admin document
      const updatedAdmin = await adminsDB.findByIdAndUpdate(
        id,
        { servicesId },
        { new: true, runValidators: true } // Return updated document, run schema validators
      );

      // Check if Admin exists
      if (!updatedAdmin) {
        return response.error(res, "Admin not found", 404);
      }

      // Return success response
      return response.success(res, "Services ID updated successfully", updatedAdmin);
    } catch (error) {
      console.error("Error updating servicesId:", error);
      return response.error(res, "Server error", 500);
    }
  }


  async updateRoomId(req, res) {
    try {
      const { adminId } = req.params;
      const { roomId } = req.body;

      // Validate adminId
      if (!mongoose.Types.ObjectId.isValid(adminId)) {
        return response.error(res, "Invalid admin ID", 400);
      }

      // Validate roomId (if provided)
      if (roomId && !mongoose.Types.ObjectId.isValid(roomId)) {
        return response.error(res, "Invalid room ID", 400);
      }

      // Check if admin exists
      const admin = await adminsDB.findById(adminId);
      if (!admin) {
        return response.notFound(res, "Admin not found");
      }

      // Update roomId (allow null to unset the field)
      admin.roomId = roomId || null;
      await admin.save();

      // Prepare response data
      const adminData = admin.toJSON();
      delete adminData.password;

      return response.success(res, "Room ID updated successfully", {
        adminId: admin._id,
        roomId: admin.roomId,
      });
    } catch (error) {
      console.error("Error updating roomId:", error);
      return response.serverError(res, error.message, error);
    }
  }
}

module.exports = new AdminController();
