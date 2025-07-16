const response = require("../utils/response");
const Employee = require("../model/adminModel"); // Assuming the EmployeeSchema is exported as Employee model
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

class AdminController {
  // Barcha xodimlarni olish (Read - All)
  async getEmployees(req, res) {
    try {
      const employees = await Employee.find().select("-password"); // Parolni chiqarmaslik uchun
      if (!employees.length)
        return response.notFound(res, "Xodimlar topilmadi");
      response.success(res, "Barcha xodimlar", employees);
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }

  // Xodimni ID bo'yicha olish (Read - Single)
  async getEmployeeById(req, res) {
    try {
      const employee = await Employee.findById(req.params.id).select(
        "-password"
      );
      if (!employee) return response.notFound(res, "Xodim topilmadi");
      response.success(res, "Xodim topildi", employee);
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }

  // Yangi xodim qo'shish (Create)
  async createEmployee(req, res) {
    try {
      let io = req.app.get("socket");
      const { login, password, isOfficeWorker } = req.body;

      // Login takrorlanmasligini tekshirish (faqat ofis xodimlari uchun)
      if (isOfficeWorker && login) {
        const existingEmployee = await Employee.findOne({ login });
        if (existingEmployee) {
          return response.error(res, "Bu login allaqachon mavjud");
        }
      }

      // Parolni shifrlash (faqat ofis xodimlari uchun)
      if (isOfficeWorker && password) {
        req.body.password = await bcrypt.hash(password, 10);
      } else {
        req.body.password = ""; // Agar ofis xodimi bo'lmasa, parol bo'sh
      }

      // Xodimni yaratish
      const employee = await Employee.create(req.body);

      // Xodimni javobga tayyorlash
      const employeeData = employee.toJSON();
      delete employeeData.password; // Parolni javobdan olib tashlash

      // Yangi xodim qo'shilganda socket orqali xabar yuborish
      io.emit("new_employee", employeeData);

      // Javob yuborish
      response.created(res, "Xodim qo'shildi", employeeData);
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }

  // Xodimni yangilash (Update)
  async updateEmployee(req, res) {
    try {
      let io = req.app.get("socket");
      const { login, password, isOfficeWorker } = req.body;

      // Login takrorlanmasligini tekshirish (faqat ofis xodimlari uchun)
      if (isOfficeWorker && login) {
        const existingEmployee = await Employee.findOne({
          login,
          _id: { $ne: req.params.id },
        });
        if (existingEmployee) {
          return response.error(res, "Bu login allaqachon mavjud");
        }
      }

      const updateData = { ...req.body };
      // Parolni yangilash (faqat ofis xodimlari uchun va agar parol berilgan bo'lsa)
      if (isOfficeWorker && password) {
        updateData.password = await bcrypt.hash(password, 10);
      } else if (!isOfficeWorker) {
        updateData.password = ""; // Agar ofis xodimi bo'lmasa, parol bo'sh
        updateData.login = ""; // Login ham bo'sh
        updateData.role = ""; // Rol ham bo'sh
      }

      const updatedEmployee = await Employee.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      );

      if (!updatedEmployee)
        return response.error(res, "Xodim yangilashda xatolik");

      const employeeData = updatedEmployee.toJSON();
      delete employeeData.password;

      io.emit("employee_updated", employeeData);
      response.success(res, "Xodim yangilandi", employeeData);
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }

  // Xodimni o'chirish (Delete)
  async deleteEmployee(req, res) {
    try {
      let io = req.app.get("socket");
      const employee = await Employee.findByIdAndDelete(req.params.id);
      if (!employee) return response.error(res, "Xodim o'chirilmadi");

      const employeeData = employee.toJSON();
      delete employeeData.password;

      io.emit("employee_deleted", employeeData);
      response.success(res, "Xodim o'chirildi");
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }

  // Xodim kirishi (Login)
  async login(req, res) {
    try {
      const { login, password } = req.body;
      const employee = await Employee.findOne({ login });
      if (!employee) return response.error(res, "Login yoki parol xato");

      // Faqat ofis xodimlari login qilishi mumkin
      if (!employee.isOfficeWorker) {
        return response.error(res, "Bu xodim tizimga kira olmaydi");
      }

      const isMatch = await bcrypt.compare(password, employee.password);
      if (!isMatch) return response.error(res, "Login yoki parol xato");

      const token = jwt.sign(
        { id: employee._id, login: employee.login },
        process.env.JWT_SECRET_KEY,
        { expiresIn: "1w" }
      );

      const employeeData = employee.toJSON();
      delete employeeData.password;

      response.success(res, "Kirish muvaffaqiyatli", {
        employee: employeeData,
        token,
      });
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }

  async loginUnitHead(req, res) {
    try {
      const { pin } = req.body;

      if (!pin) {
        return response.warning(res, "Parol kiritilishi shart");
      }

      const unitHead = await Employee.findOne({ unitHeadPassword: pin });

      if (!unitHead) {
        return response.error(
          res,
          "Parol noto‘g‘ri yoki foydalanuvchi topilmadi"
        );
      }

      const token = jwt.sign(
        { id: unitHead._id, login: unitHead.login },
        process.env.JWT_SECRET_KEY,
        { expiresIn: "1w" }
      );

      const unitHeadData = unitHead.toJSON();
      delete unitHeadData.password;
      delete unitHeadData.unitHeadPassword;

      response.success(res, "Bo‘lim boshlig‘i sifatida kirildi", {
        employee: unitHeadData,
        token,
      });
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }
}

module.exports = new AdminController();
