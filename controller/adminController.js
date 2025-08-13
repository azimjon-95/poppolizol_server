const mongoose = require("mongoose");
const Employee = require("../model/adminModel"); // Assuming the EmployeeSchema is exported as Employee model
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const response = require("../utils/response");

class AdminController {
  // Barcha xodimlarni olish (Read - All)
  async getEmployees(req, res) {
    try {
      const employees = await Employee.find().select("-password -unitHeadPassword");
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
        "-password -unitHeadPassword"
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
      const { login, password, isOfficeWorker, unit, unitHeadPassword } = req.body;

      // Login takrorlanmasligini tekshirish (faqat ofis xodimlari uchun)
      if (login) {
        const existingEmployee = await Employee.findOne({ login });
        if (existingEmployee) {
          return response.error(res, "Bu login allaqachon mavjud");
        }
      }

      // Parolni shifrlash (faqat ofis xodimlari uchun)
      if (password) {
        req.body.password = await bcrypt.hash(password, 10);
      } else {
        req.body.password = "";
      }

      // unitHeadPassword ni shifrlash (agar berilgan bo'lsa va unit mos bo'lsa)
      const managerialUnits = [
        "polizol ish boshqaruvchi",
        "rubiroid ish boshqaruvchi",
        "Okisleniya ish boshqaruvchi",
      ];
      if (managerialUnits.includes(unit) && unitHeadPassword) {
        req.body.unitHeadPassword = await bcrypt.hash(unitHeadPassword, 10);
      } else if (!managerialUnits.includes(unit)) {
        req.body.unitHeadPassword = "";
      }

      // Xodimni yaratish
      const employee = await Employee.create(req.body);

      // Xodimni javobga tayyorlash
      const employeeData = employee.toJSON();
      delete employeeData.password;
      delete employeeData.unitHeadPassword;

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
      const { login, password, isOfficeWorker, unit, unitHeadPassword } = req.body;

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
        updateData.password = "";
        updateData.login = "";
        updateData.role = "";
      }

      // unitHeadPassword ni yangilash (agar unit mos bo'lsa va unitHeadPassword berilgan bo'lsa)
      const managerialUnits = [
        "polizol ish boshqaruvchi",
        "rubiroid ish boshqaruvchi",
        "Okisleniya ish boshqaruvchi",
      ];
      if (managerialUnits.includes(unit) && unitHeadPassword) {
        updateData.unitHeadPassword = await bcrypt.hash(unitHeadPassword, 10);
      } else if (!managerialUnits.includes(unit)) {
        updateData.unitHeadPassword = "";
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
      delete employeeData.unitHeadPassword;

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
      delete employeeData.unitHeadPassword;

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
        { id: employee._id, login: employee.login, isOfficeWorker: employee.isOfficeWorker },
        process.env.JWT_SECRET_KEY,
        { expiresIn: "1w" }
      );

      const employeeData = employee.toJSON();
      delete employeeData.password;
      delete employeeData.unitHeadPassword;

      response.success(res, "Kirish muvaffaqiyatli", {
        employee: employeeData,
        token,
      });
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }

  // Bo'lim boshlig'i pinCode orqali kirishi
  async loginUnitHead(req, res) {
    try {
      const { pin } = req.body;
      if (!pin) {
        return response.warning(res, "PinCode kiritilishi shart");
      }

      // PinCode (unitHeadPassword) bo'yicha xodimni qidirish
      const unitHead = await Employee.findOne({ unitHeadPassword: { $exists: true, $ne: "" } });

      if (!unitHead) {
        return response.error(res, "pin noto‘g‘ri yoki foydalanuvchi topilmadi");
      }

      // PinCode ni tekshirish
      const isMatch = await bcrypt.compare(pin, unitHead.unitHeadPassword);
      if (!isMatch) {
        return response.error(res, "PinCode noto‘g‘ri");
      }

      // Unit ni tekshirish
      const managerialUnits = [
        "polizol ish boshqaruvchi",
        "rubiroid ish boshqaruvchi",
        "Okisleniya ish boshqaruvchi",
      ];
      if (!managerialUnits.includes(unitHead.unit)) {
        return response.error(res, "Bu xodim bo‘lim boshlig‘i emas");
      }

      // JWT token yaratish
      const token = jwt.sign(
        { id: unitHead._id, login: unitHead.login, unit: unitHead.unit },
        process.env.JWT_SECRET_KEY,
        { expiresIn: "1w" }
      );

      // Xodim ma'lumotlarini tayyorlash
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


  async OkisleniyaEmployees(req, res) {

    try {
      const employees = await Employee.find({
        unit: {
          $in: ['Okisleniya', 'Okisleniya ish boshqaruvchi']
        }
      }).select('-unitHeadPassword');

      if (!employees || employees.length === 0) {
        return response.notFound(res, "No employees found with specified units");
      }

      return response.success(res, "Employees retrieved successfully", {
        count: employees.length,
        employees
      });
    } catch (error) {

      return response.serverError(res, "Server error", { error: error.message });
    }
  };


  async getProductionEmployees(req, res) {
    try {
      const productionEmployees = await Employee.find({ role: "ishlab chiqarish" });

      if (!productionEmployees.length) {
        return response.serverError(res, "Ishlab chiqarish xodimlari topilmadi");
      }

      return response.success(res, "Employees retrieved successfully", productionEmployees);
    } catch (error) {
      return response.serverError(res, "Server error", { error: error.message });
    }
  }
}

module.exports = new AdminController();





