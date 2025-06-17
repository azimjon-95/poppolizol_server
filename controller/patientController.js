const response = require("../utils/response");
const patientsDB = require("../model/patientModel");
const storyDB = require("../model/storyModel");
const adminDB = require("../model/adminModel");

class PatientController {
  async createPatient(req, res) {
    try {
      let {
        firstname,
        lastname,
        idNumber,
        phone,
        address,
        year,
        gender,
        paymentType,
        payment_amount,
        services, // Extract services from req.body
        doctorId,
      } = req.body;

      // Telefon raqami orqali bemorni qidirish
      let patient = await patientsDB.findOne({ phone });
      if (!patient) {
        patient = await patientsDB.create({
          firstname,
          lastname,
          idNumber,
          phone,
          address,
          year,
          gender,
        });
      }

      // Validate doctorId
      if (!doctorId) return response.error(res, 'doctorId is required');

      // Shu doktorga yozilgan, view: false bo'lgan storylarni sanash
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const count = await storyDB.countDocuments({
        doctorId: doctorId,
        view: 0,
        createdAt: { $gte: today, $lt: tomorrow },
      });

      // order_number = navbat raqami
      const orderNumber = count + 1;

      let doctor = await adminDB.findById(doctorId);
      if (!doctor) return response.error(res, 'Doctor not found');

      // Calculate total service price (if services provided)
      const totalServicePrice = services.reduce((sum, service) => sum + service.price || 0);

      // Update payment_status logic (optional)
      // Example: Check if payment_amount matches doctor's admission_price + service prices
      const paymentStatus = doctor && payment_amount === doctor && admission_price + totalServicePrice;

      // Story yaratish
      const story = await storyDB.create({
        patientId: patient._id,
        doctorId,
        order_number: orderNumber,
        paymentType,
        payment_status: paymentStatus,
        payment_amount,
        services: services || [], // Save services to storyDB
      });

      return response.success(res, 'Bemor va story muvaffaqiyatli yaratildi', {
        patient: {
          firstname,
          lastname,
          phone,
          idNumber,
          address,
          order_number: orderNumber,
          createdAt: story.createdAt,
        },
        doctor: {
          firstName: doctor.firstName,
          lastName: doctor.lastName,
          specialization: doctor.specialization,
          phone: phone,
          admission_price: totalServicePrice,
        },
        services: services || [], // Return services in response
      });
    } catch (err) {
      console.error('Error in createPatient:', err);
      return response.serverError(res, 'Server error occurred', err.message);
    }
  }

  async getPatients(req, res) {
    try {
      const patients = await patientsDB.find().sort({ createdAt: -1 });
      if (!patients.length) return response.notFound(res, "Bemorlar topilmadi");
      return response.success(res, "Success", patients);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  // Bemorni ID orqali olish
  async getPatientById(req, res) {
    try {
      const patient = await patientsDB.findById(req.params.id);
      if (!patient) return response.notFound(res, "Bemor topilmadi");
      return response.success(res, "Success", patient);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  // Bemorni yangilash
  async updatePatient(req, res) {
    try {
      const patient = await patientsDB.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      if (!patient) return response.notFound(res, "Bemor topilmadi");
      return response.success(res, "Bemor yangilandi", patient);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  // Bemorni o'chirish
  async deletePatient(req, res) {
    try {
      const patient = await patientsDB.findByIdAndDelete(req.params.id);
      if (!patient) return response.notFound(res, "Bemor topilmadi");
      return response.success(res, "Bemor o'chirildi", patient);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }
}

module.exports = new PatientController();
