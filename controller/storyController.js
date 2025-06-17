const response = require("../utils/response");
const storyDB = require("../model/storyModel");
const moment = require("moment");

class StoryController {
  // async getStory(req, res) {
  //   try {
  //     const stories = await storyDB
  //       .find()
  //       .sort({ createdAt: -1 })
  //       .populate("patientId")
  //       .populate("doctorId");
  //     if (!stories.length) return response.notFound(res, "Bemorlar topilmadi");
  //     return response.success(res, "Success", stories);
  //   } catch (err) {
  //     return response.serverError(res, err.message, err);
  //   }
  // }

  async getStory(req, res) {
    try {
      let filter = {};
      let startDay, endDay;

      if (req.query.startDay && req.query.endDay) {
        // Agar frontenddan startDay va endDay kelsa, shu oraliqni olamiz
        startDay = new Date(req.query.startDay);
        startDay.setHours(0, 0, 0, 0);
        endDay = new Date(req.query.endDay);
        endDay.setHours(23, 59, 59, 999);
      } else {
        // Aks holda, oxirgi 7 kunni olamiz
        endDay = new Date();
        endDay.setHours(23, 59, 59, 999);
        startDay = new Date();
        startDay.setDate(endDay.getDate() - 6);
        startDay.setHours(0, 0, 0, 0);
      }

      filter.createdAt = { $gte: startDay, $lte: endDay };

      const stories = await storyDB
        .find(filter)
        .sort({ createdAt: -1 })
        .populate("patientId")
        .populate("doctorId");

      if (!stories.length) return response.notFound(res, "Bemorlar topilmadi");

      return response.success(res, "Success", stories);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  async getStoryByPatientId(req, res) {
    try {
      const stories = await storyDB
        .find({ patientId: req.params.id })
        .sort({ createdAt: -1 })
        .populate("patientId")
        .populate("doctorId");
      if (!stories.length) return response.notFound(res, "Bemorlar topilmadi");
      return response.success(res, "Bemor topildi", stories);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  async getStoryByDoctorId(req, res) {
    try {
      const stories = await storyDB
        .find({ doctorId: req.params.id })
        .sort({ createdAt: -1 })
        .populate("patientId")
        .populate("doctorId");
      if (!stories.length) return response.notFound(res, "Bemorlar topilmadi");
      return response.success(res, "Bemor topildi", stories);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  async updateStory(req, res) {
    try {
      const story = await storyDB.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });
      if (!story) return response.notFound(res, "Bemor topilmadi");
      return response.success(res, "Bemor yangilandi", story);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  async getTodaysStory(req, res) {
    try {
      const startOfDay = moment().startOf("day").toDate();
      const endOfDay = moment().endOf("day").toDate();

      const stories = await storyDB
        .find({
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          view: false,
        })
        .sort({ createdAt: -1 })
        .populate("patientId")
        .populate("doctorId");

      if (!stories.length) return response.notFound(res, "Bemorlar topilmadi");
      return response.success(res, "Bemorlar topildi", stories);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }
}

module.exports = new StoryController();
