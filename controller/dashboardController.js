const Admin = require("../model/adminModel");
const RoomStory = require("../model/roomStoryModel");
const moment = require("moment");
const response = require("../utils/response");
const Stories = require("../model/storyModel");
const Expenses = require("../model/expenseModel");

async function getDashboard(req, res) {
  try {
    // ============================ DOCTOR MALUMOTLARINI OLISH  ===================================================
    const doctors = await Admin.find({ role: "doctor" });

    // Oyni aniqlash: frontenddan month (MM-YYYY yoki MM.YYYY) kelsa, shu oy, bo'lmasa joriy oy
    let startDate, endDate;
    if (req.query.month) {
      // "06-2025" yoki "06.2025" formatlarini qo'llab-quvvatlash
      let [year, month] = req.query.month.split("-");
      startDate = moment(`${year}-${month}-01`).startOf("month").toDate();
      endDate = moment(`${year}-${month}-01`).endOf("month").toDate();
    } else {
      // Joriy oy
      startDate = moment().startOf("month").toDate();
      endDate = moment().endOf("month").toDate();
    }

    const report = [];

    for (const doc of doctors) {
      // Shu oy doctor qabul qilgan bemorlar
      const periodStories = await RoomStory.find({
        doctorId: doc._id,
        createdAt: { $gte: startDate, $lte: endDate },
      });

      // Umumiy qabul qilgan bemorlar
      const allStories = await RoomStory.find({ doctorId: doc._id });

      const periodCount = periodStories.length;
      const clientLength = allStories.length;

      const totalPrice = allStories.reduce(
        (sum, s) => sum + (doc.admission_price || 0),
        0
      );
      const periodPrice = periodStories.reduce(
        (sum, s) => sum + (doc.admission_price || 0),
        0
      );

      let ownPrice = 0;
      if (doc.salary_type === "percentage") {
        ownPrice = Math.round(
          ((doc.percentage_from_admissions || 0) * totalPrice) / 100
        );
      } else {
        ownPrice = doc.salary_per_month || 0;
      }

      report.push({
        idNumber: doc._id,
        firstName: doc.firstName,
        lastName: doc.lastName,
        specialization: doc.specialization,
        percent: doc.percentage_from_admissions || 0,
        salary: doc.salary_per_month || 0,
        periodCount, // Shu oy/kundagi bemorlar soni
        periodPrice, // Shu oy/kundagi tushum
        totalPrice,
        clientLength,
        ownPrice,
      });
    }

    // ============================ CARDLAR UCHUN BEMORLAR OQIMI ===================================================

    // storylarni o'z ichiga olgan hisobot
    const storiesLength = await Stories.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
    });

    // O‘tgan oy boshlanishi va tugashi
    const prevMonthStart = moment(startDate)
      .subtract(1, "month")
      .startOf("month")
      .toDate();
    const prevMonthEnd = moment(startDate)
      .subtract(1, "month")
      .endOf("month")
      .toDate();

    const prevStoriesLength = await Stories.countDocuments({
      createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd },
    });

    // Foiz o‘sishni hisoblash
    let percentChange = null;
    if (prevStoriesLength === 0 && storiesLength > 0) {
      percentChange = 100;
    } else if (prevStoriesLength === 0 && storiesLength === 0) {
      percentChange = 0;
    } else {
      percentChange =
        ((storiesLength - prevStoriesLength) / prevStoriesLength) * 100;
      percentChange = Math.round(percentChange * 10) / 10; // 1 xonali kasr
    }
    // ============================ CARDLAR UCHUN BEMORLAR DAVOLANISHI ===================================================

    // Bu oydagi yotgan bemorlar soni
    const roomStoriesLength = await RoomStory.countDocuments({
      $expr: {
        $and: [
          {
            $gte: [
              {
                $dateFromString: {
                  dateString: "$startDay",
                  format: "%d.%m.%Y %H:%M",
                },
              },
              startDate,
            ],
          },
          {
            $lte: [
              {
                $dateFromString: {
                  dateString: "$startDay",
                  format: "%d.%m.%Y %H:%M",
                },
              },
              endDate,
            ],
          },
        ],
      },
    });

    // O‘tgan oy yotgan bemorlar soni
    const prevRoomStoriesLength = await RoomStory.countDocuments({
      $expr: {
        $and: [
          {
            $gte: [
              {
                $dateFromString: {
                  dateString: "$startDay",
                  format: "%d.%m.%Y %H:%M",
                },
              },
              prevMonthStart,
            ],
          },
          {
            $lte: [
              {
                $dateFromString: {
                  dateString: "$startDay",
                  format: "%d.%m.%Y %H:%M",
                },
              },
              prevMonthEnd,
            ],
          },
        ],
      },
    });

    // Foiz o‘sishini hisoblash
    let roomPercentChange = null;
    if (prevRoomStoriesLength === 0 && roomStoriesLength > 0) {
      roomPercentChange = 100;
    } else if (prevRoomStoriesLength === 0 && roomStoriesLength === 0) {
      roomPercentChange = 0;
    } else {
      roomPercentChange =
        ((roomStoriesLength - prevRoomStoriesLength) / prevRoomStoriesLength) *
        100;
      roomPercentChange = Math.round(roomPercentChange * 10) / 10; // 1 xonali kasr
    }

    // Natija
    const yotqizilganBemorlar = {
      thisMonth: roomStoriesLength,
      // prevMonth: prevRoomStoriesLength,
      percentChange: roomPercentChange,
    };

    // ============================ CARDLAR UCHUN DAROMAD KIRIM CHIQIMLARI ===================================================

    // Joriy oy kirim/chiqim
    const kirim_chiqim = await Expenses.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: "$type", // "kirim" yoki "chiqim"
          total: { $sum: "$amount" },
        },
      },
    ]);

    // O‘tgan oy kirim/chiqim
    const prevKirimChiqim = await Expenses.aggregate([
      {
        $match: {
          createdAt: {
            $gte: prevMonthStart,
            $lte: prevMonthEnd,
          },
        },
      },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
        },
      },
    ]);

    function getPercentChange(current, prev) {
      if (prev === 0 && current > 0) return 100;
      if (prev === 0 && current === 0) return 0;
      if (prev === 0 && current < 0) return -100; // yoki -Infinity
      return Math.round(((current - prev) / prev) * 1000) / 10;
    }

    // Har bir type uchun foiz o‘zgarish
    const kirimChiqimPercent = kirim_chiqim.map((item) => {
      const prev = prevKirimChiqim.find((p) => p._id === item._id);
      return {
        type: item._id,
        thisMonth: item.total,
        prevMonth: prev ? prev.total : 0,
        percentChange: getPercentChange(item.total, prev ? prev.total : 0),
      };
    });

    // Joriy oy kirim va chiqim qiymatlari
    const kirim = kirim_chiqim.find((k) => k._id === "kirim")?.total || 0;
    const chiqim = kirim_chiqim.find((k) => k._id === "chiqim")?.total || 0;
    const sofFoyda = kirim - chiqim;

    // O‘tgan oy kirim va chiqim qiymatlari
    const prevKirim =
      prevKirimChiqim.find((k) => k._id === "kirim")?.total || 0;
    const prevChiqim =
      prevKirimChiqim.find((k) => k._id === "chiqim")?.total || 0;
    const prevSofFoyda = prevKirim - prevChiqim;

    // ============================ SOF FOYDA ===================================================
    const sofFoydaPercentChange = getPercentChange(sofFoyda, prevSofFoyda);

    const daysInMonth = moment(startDate).daysInMonth();
    const kirimArray = [];
    const chiqimArray = [];

    // Barcha oy kunlari uchun massivlarni tayyorlab chiqamiz
    for (let i = 1; i <= daysInMonth; i++) {
      kirimArray.push({ date: i, amount: 0 });
      chiqimArray.push({ date: i, amount: 0 });
    }

    // Shu oy uchun barcha xarajatlarni olamiz
    const expenses = await Expenses.find({
      createdAt: { $gte: startDate, $lte: endDate },
    });

    // Har bir xarajatni kerakli kun va tip bo‘yicha massivga joylaymiz
    expenses.forEach((exp) => {
      const day = moment(exp.createdAt).date(); // 1 dan 31 gacha
      if (exp.type === "kirim") {
        kirimArray[day - 1].amount += exp.amount;
      } else if (exp.type === "chiqim") {
        chiqimArray[day - 1].amount += exp.amount;
      }
    });

    // Kunlik bemorlar soni (chart uchun)
    //=============================== KUNLIK BEMORLAR SONI CHART UCHN ===================================================
    const dailyPatients = await RoomStory.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { day: { $dayOfMonth: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
    ]);

    // Oydagi barcha kunlar uchun massiv tayyorlash
    const dailyPatientsArray = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const found = dailyPatients.find((d) => d._id.day === i);
      dailyPatientsArray.push({ date: i, count: found ? found.count : 0 });
    }

    // barcha harahat
    let harajatlar = await Expenses.find({
      createdAt: { $gte: startDate, $lte: endDate },
    });

    let data = {
      doctorsInfo: report,
      bemorlarOqimi: {
        thisMonth: storiesLength,
        prevMonth: percentChange,
      },
      yotqizilganBemorlar,
      kirim: kirimChiqimPercent.find((k) => k.type === "kirim"),
      chiqim: kirimChiqimPercent.find((k) => k.type === "chiqim"),
      sofFoyda: {
        thisMonth: sofFoyda,
        prevMonth: prevSofFoyda,
        percentChange: sofFoydaPercentChange,
      },
      kirim_chiqimChart: {
        kirim: kirimArray,
        chiqim: chiqimArray,
      },
      kunlikOqim: dailyPatientsArray,
      harajatlar,
    };

    return response.success(
      res,
      `${moment(startDate).format("YYYY-MM-DD")} - ${moment(endDate).format(
        "YYYY-MM-DD"
      )}  oraliq uchun`,
      data
    );
  } catch (err) {
    return response.serverError(res, err.message, err);
  }
}

module.exports = { getDashboard };
