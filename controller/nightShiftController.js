const mongoose = require('mongoose');
const { NightShift, ShiftReport } = require('../model/nightShiftSchema');
const Admin = require('../model/adminModel'); // Assuming Admin model exists

class NightShiftController {
    // Get all nurses
    async getNurses(req, res) {
        try {
            const nurses = await Admin.find({ role: 'nurse' })
                .select('-password')
                .sort({ firstName: 1 });
            res.json(nurses);
        } catch (error) {
            res.status(500).json({ message: 'Xato yuz berdi', error: error.message });
        }
    }

    // Get all night shifts
    async getNightShifts(req, res) {
        try {
            const { startDate, endDate, nurseId } = req.query;
            let query = {};

            if (startDate && endDate) {
                query.date = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
            }

            if (nurseId) {
                query['nurses.nurseId'] = nurseId;
            }

            const shifts = await NightShift.find(query)
                .populate('nurses.nurseId', 'firstName lastName specialization')
                .sort({ date: 1 });

            res.json(shifts);
        } catch (error) {
            res.status(500).json({ message: 'Xato yuz berdi', error: error.message });
        }
    }

    // Create new night shift
    async createNightShift(req, res) {
        try {
            const { date, nurses, shiftPrice = 100000 } = req.body;

            const existingShift = await NightShift.findOne({ date: new Date(date) });
            if (existingShift) {
                return res.status(400).json({ message: 'Bu sanada smena allaqachon mavjud' });
            }

            const nurseDetails = await Admin.find({
                _id: { $in: nurses },
                role: 'nurse'
            });

            if (nurseDetails.length !== nurses.length) {
                return res.status(400).json({ message: 'Ba\'zi hamshiralar topilmadi' });
            }

            const shiftNurses = nurseDetails.map(nurse => ({
                nurseId: nurse._id,
                nurseName: `${nurse.firstName} ${nurse.lastName}`,
                shiftPrice,
                scheduled: true
            }));

            const nightShift = new NightShift({
                date: new Date(date),
                nurses: shiftNurses,
                totalCost: shiftNurses.length * shiftPrice,
            });

            const savedShift = await nightShift.save();
            await savedShift.populate('nurses.nurseId', 'firstName lastName specialization');

            res.status(201).json(savedShift);
        } catch (error) {
            res.status(500).json({ message: 'Xato yuz berdi', error: error.message });
        }
    }

    // Update night shift
    async updateNightShift(req, res) {
        try {
            const { nurses, shiftPrice } = req.body;

            const shift = await NightShift.findById(req.params.id);
            if (!shift) {
                return res.status(404).json({ message: 'Smena topilmadi' });
            }

            if (nurses) {
                const nurseDetails = await Admin.find({
                    _id: { $in: nurses },
                    role: 'nurse'
                });

                if (nurseDetails.length !== nurses.length) {
                    return res.status(400).json({ message: 'Ba\'zi hamshiralar topilmadi' });
                }

                const shiftNurses = nurseDetails.map(nurse => ({
                    nurseId: nurse._id,
                    nurseName: `${nurse.firstName} ${nurse.lastName}`,
                    shiftPrice: shiftPrice || 150000,
                    scheduled: true
                }));

                shift.nurses = shiftNurses;
                shift.totalCost = shiftNurses.length * (shiftPrice || 150000);
            }

            const updatedShift = await shift.save();
            await updatedShift.populate('nurses.nurseId', 'firstName lastName specialization');

            res.json(updatedShift);
        } catch (error) {
            res.status(500).json({ message: 'Xato yuz berdi', error: error.message });
        }
    }

    // Delete night shift
    async deleteNightShift(req, res) {
        try {
            const shift = await NightShift.findById(req.params.id);
            if (!shift) {
                return res.status(404).json({ message: 'Smena topilmadi' });
            }

            if (shift.status === 'active') {
                return res.status(400).json({ message: 'Faol smenani o\'chirib bo\'lmaydi' });
            }

            await NightShift.findByIdAndDelete(req.params.id);
            res.json({ message: 'Smena o\'chirildi' });
        } catch (error) {
            res.status(500).json({ message: 'Xato yuz berdi', error: error.message });
        }
    }

    // Remove nurse from shift
    async removeNurseFromShift(req, res) {
        try {
            const shift = await NightShift.findById(req.params.id);
            if (!shift) {
                return res.status(404).json({ message: 'Smena topilmadi' });
            }

            shift.nurses = shift.nurses.filter(nurse => nurse.nurseId.toString() !== req.params.nurseId);
            shift.totalCost = shift.nurses.length * (shift.nurses[0]?.shiftPrice || 150000);

            const updatedShift = await shift.save();
            await updatedShift.populate('nurses.nurseId', 'firstName lastName specialization');

            res.json(updatedShift);
        } catch (error) {
            res.status(500).json({ message: 'Xato yuz berdi', error: error.message });
        }
    }

    // Start shift
    async startShift(req, res) {
        try {
            const { nurseId } = req.body;

            const shift = await NightShift.findById(req.params.id);
            if (!shift) {
                return res.status(404).json({ message: 'Smena topilmadi' });
            }
            const nurseIndex = shift.nurses.findIndex(n => n.nurseId.equals(nurseId)); // Use .equals() for ObjectId comparison
            if (nurseIndex === -1) {
                return res.status(404).json({ message: 'Hamshira smenada topilmadi' });
            }

            shift.nurses[nurseIndex].attended = true;
            shift.nurses[nurseIndex].startTime = new Date();

            if (shift.status === 'scheduled') {
                shift.status = 'active';
            }

            const updatedShift = await shift.save();
            res.json(updatedShift);
        } catch (error) {
            res.status(500).json({ message: 'Xato yuz berdi', error: error.message });
        }
    }

    // End shift
    async endShift(req, res) {
        try {
            const { nurseId } = req.body;

            const shift = await NightShift.findById(req.params.id);
            if (!shift) {
                return res.status(404).json({ message: 'Smena topilmadi' });
            }

            const nurseIndex = shift.nurses.findIndex(n => n.nurseId.toString() === nurseId);
            if (nurseIndex === -1) {
                return res.status(404).json({ message: 'Hamshira smenada topilmadi' });
            }

            shift.nurses[nurseIndex].endTime = new Date();

            const allEnded = shift.nurses.every(nurse => nurse.endTime || !nurse.attended);
            if (allEnded) {
                shift.status = 'completed';
            }

            const updatedShift = await shift.save();
            res.json(updatedShift);
        } catch (error) {
            res.status(500).json({ message: 'Xato yuz berdi', error: error.message });
        }
    }

    // Auto schedule shifts
    async autoScheduleShifts(req, res) {
        try {
            const { year, month, shiftPrice = 150000 } = req.body;

            const nurses = await Admin.find({ role: 'nurse' });
            if (nurses.length === 0) {
                return res.status(400).json({ message: 'Hamshiralar topilmadi' });
            }

            const startDate = new Date(year, month, 1);
            const endDate = new Date(year, month + 1, 0);
            const daysInMonth = endDate.getDate();

            const createdShifts = [];

            for (let day = 1; day <= daysInMonth; day++) {
                const currentDate = new Date(year, month, day);

                const existingShift = await NightShift.findOne({ date: currentDate });
                if (existingShift) continue;

                const numNurses = Math.floor(Math.random() * 3) + 1;
                const selectedNurses = [];

                while (selectedNurses.length < numNurses && selectedNurses.length < nurses.length) {
                    const randomNurse = nurses[Math.floor(Math.random() * nurses.length)];
                    if (!selectedNurses.find(n => n._id.toString() === randomNurse._id.toString())) {
                        selectedNurses.push(randomNurse);
                    }
                }

                const shiftNurses = selectedNurses.map(nurse => ({
                    nurseId: nurse._id,
                    nurseName: `${nurse.firstName} ${nurse.lastName}`,
                    shiftPrice,
                    scheduled: true
                }));

                const nightShift = new NightShift({
                    date: currentDate,
                    nurses: shiftNurses,
                    totalCost: shiftNurses.length * shiftPrice,
                });

                const savedShift = await nightShift.save();
                createdShifts.push(savedShift);
            }

            res.json({
                message: `${createdShifts.length} ta smena yaratildi`,
                shifts: createdShifts
            });
        } catch (error) {
            res.status(500).json({ message: 'Xato yuz berdi', error: error.message });
        }
    }

    // Create shift report
    async createShiftReport(req, res) {
        try {
            const { shiftId, activities, patientsCount, emergencyCalls, notes, rating } = req.body;

            const shift = await NightShift.findById(shiftId);
            if (!shift) {
                return res.status(404).json({ message: 'Smena topilmadi' });
            }

            const nurseInShift = shift.nurses.find(n => n.nurseId.toString() === req.user.id);
            if (!nurseInShift) {
                return res.status(403).json({ message: 'Siz bu smenada ishtirok etmagansiz' });
            }

            const report = new ShiftReport({
                shiftId,
                nurseId: req.user.id,
                date: shift.date,
                activities: activities || [],
                patientsCount: patientsCount || 0,
                emergencyCalls: emergencyCalls || 0,
                notes: notes || '',
                rating: 5
            });

            const savedReport = await report.save();
            await savedReport.populate('nurseId', 'firstName lastName');

            res.status(201).json(savedReport);
        } catch (error) {
            res.status(500).json({ message: 'Xato yuz berdi', error: error.message });
        }
    }

    // Get shift reports
    async getShiftReports(req, res) {
        try {
            const { shiftId, nurseId, startDate, endDate } = req.query;
            let query = {};

            if (shiftId) query.shiftId = shiftId;
            if (nurseId) query.nurseId = nurseId;
            if (startDate && endDate) {
                query.date = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
            }

            const reports = await ShiftReport.find(query)
                .populate('nurseId', 'firstName lastName specialization')
                .populate('shiftId', 'date status')
                .sort({ date: -1 });

            res.json(reports);
        } catch (error) {
            res.status(500).json({ message: 'Xato yuz berdi', error: error.message });
        }
    }

    // Get shift statistics
    async getShiftStatistics(req, res) {
        try {
            const { startDate, endDate } = req.query;
            let matchStage = {};

            if (startDate && endDate) {
                matchStage.date = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
            }

            const stats = await NightShift.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: null,
                        totalShifts: { $sum: 1 },
                        completedShifts: {
                            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                        },
                        activeShifts: {
                            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                        },
                        scheduledShifts: {
                            $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] }
                        },
                        totalCost: { $sum: '$totalCost' },
                        avgNursesPerShift: { $avg: { $size: '$nurses' } }
                    }
                }
            ]);

            const nurseStats = await NightShift.aggregate([
                { $match: matchStage },
                { $unwind: '$nurses' },
                { $match: { 'nurses.attended': true } },
                {
                    $group: {
                        _id: '$nurses.nurseId',
                        nurseName: { $first: '$nurses.nurseName' },
                        totalShifts: { $sum: 1 },
                        totalEarnings: { $sum: '$nurses.shiftPrice' }
                    }
                },
                { $sort: { totalShifts: -1 } }
            ]);

            res.json({
                general: stats[0] || {
                    totalShifts: 0,
                    completedShifts: 0,
                    activeShifts: 0,
                    scheduledShifts: 0,
                    totalCost: 0,
                    avgNursesPerShift: 0
                },
                nurseStats
            });
        } catch (error) {
            res.status(500).json({ message: 'Xato yuz berdi', error: error.message });
        }
    }

    // Get nurse earnings
    async getNurseEarnings(req, res) {
        try {
            const { startDate, endDate } = req.query;
            const { nurseId } = req.params;

            let matchStage = {
                'nurses.nurseId': new mongoose.Types.ObjectId(nurseId),
                'nurses.attended': true
            };

            if (startDate && endDate) {
                matchStage.date = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
            }

            const earnings = await NightShift.aggregate([
                { $match: matchStage },
                { $unwind: '$nurses' },
                { $match: { 'nurses.nurseId': new mongoose.Types.ObjectId(nurseId) } },
                {
                    $group: {
                        _id: {
                            year: { $year: '$date' },
                            month: { $month: '$date' }
                        },
                        totalShifts: { $sum: 1 },
                        totalEarnings: { $sum: '$nurses.shiftPrice' },
                        dates: { $push: '$date' }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]);

            res.json(earnings);
        } catch (error) {
            res.status(500).json({ message: 'Xato yuz berdi', error: error.message });
        }
    }

    // GET /api/reports
    async getNurseReports(req, res) {
        try {
            const { dateFrom, dateTo, nurseId } = req.query;

            // Validate input
            if (!dateFrom || !dateTo) {
                return res.status(400).json({ message: 'dateFrom and dateTo are required' });
            }

            // Parse dates to UTC
            const startDate = new Date(dateFrom);
            const endDate = new Date(dateTo);
            endDate.setUTCHours(23, 59, 59, 999); // Include entire end date

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                return res.status(400).json({ message: 'Invalid date format' });
            }

            // Build query
            const matchStage = {
                date: {
                    $gte: startDate,
                    $lte: endDate,
                },
            };

            // Unwind nurses array and filter by nurseId if provided
            const pipeline = [
                { $match: matchStage },
                { $unwind: '$nurses' },
            ];

            if (nurseId) {
                pipeline.push({
                    $match: { 'nurses.nurseId': new mongoose.Types.ObjectId(nurseId) },
                });
            }

            // Project relevant fields
            pipeline.push({
                $project: {
                    _id: '$nurses._id',
                    date: '$date',
                    nurseId: '$nurses.nurseId',
                    nurseName: '$nurses.nurseName',
                    attended: '$nurses.attended',
                    price: '$nurses.shiftPrice',
                },
            });

            // Execute aggregation for shifts
            const shifts = await NightShift.aggregate(pipeline);

            // Calculate summary
            const summary = {
                totalShifts: shifts.length,
                totalCost: shifts.reduce((sum, shift) => sum + (shift.price || 0), 0),
            };

            // Format response
            const response = {
                shifts: shifts.map(shift => ({
                    _id: shift._id,
                    date: shift.date.toISOString().split('T')[0], // YYYY-MM-DD
                    nurseId: shift.nurseId,
                    nurseName: shift.nurseName,
                    attended: shift.attended,
                    price: shift.price,
                })),
                summary,
            };

            res.status(200).json(response);
        } catch (error) {
            console.error('Error fetching reports:', error);
            res.status(500).json({ message: 'Server error while fetching reports' });
        }
    };
}

module.exports = new NightShiftController();