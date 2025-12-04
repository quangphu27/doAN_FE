const Joi = require('joi');
const Report = require('../models/BaoCao');
const Child = require('../models/TreEm');
const Progress = require('../models/TienDo');

const generateReport = async (req, res, next) => {
	try {
		const schema = Joi.object({
			childId: Joi.string().required(),
			period: Joi.string().valid('daily', 'weekly', 'monthly').required(),
			startDate: Joi.date().required(),
			endDate: Joi.date().required()
		});
		const { childId, period, startDate, endDate } = await schema.validateAsync(req.body);
		
		const child = await Child.findOne({ _id: childId, parent: req.user.id });
		if (!child) return res.status(404).json({ success: false, message: 'Không tìm thấy trẻ' });
		
		const progressData = await Progress.aggregate([
			{
				$match: {
					child: child._id,
					updatedAt: { $gte: startDate, $lte: endDate }
				}
			},
			{
				$lookup: {
					from: 'baihocs',
					localField: 'lesson',
					foreignField: '_id',
					as: 'lessonData'
				}
			},
			{ $unwind: '$lessonData' },
			{
				$group: {
					_id: null,
					totalLessons: { $sum: 1 },
					completedLessons: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
					averageScore: { $avg: '$score' },
					totalTimeSpent: { $sum: '$timeSpent' },
					strengths: { $addToSet: '$lessonData.category' },
					improvements: { $addToSet: { $cond: [{ $lt: ['$score', 70] }, '$lessonData.category', null] } }
				}
			}
		]);
		
		const data = progressData[0] || { totalLessons: 0, completedLessons: 0, averageScore: 0, totalTimeSpent: 0, strengths: [], improvements: [] };
		
		const aiRecommendations = {
			nextSteps: [
				'Tăng cường luyện tập các bài học chưa hoàn thành',
				'Thực hành thêm các trò chơi giáo dục',
				'Đọc sách cùng con mỗi ngày'
			],
			areasToFocus: data.improvements.filter(Boolean),
			encouragement: `Chúc mừng! Con đã hoàn thành ${data.completedLessons}/${data.totalLessons} bài học với điểm trung bình ${Math.round(data.averageScore)}/100.`
		};
		
		const report = await Report.create({
			child: childId,
			parent: req.user.id,
			period,
			startDate,
			endDate,
			summary: {
				totalLessons: data.totalLessons,
				completedLessons: data.completedLessons,
				totalGames: 0, 
				completedGames: 0,
				averageScore: Math.round(data.averageScore),
				timeSpent: data.totalTimeSpent,
				strengths: data.strengths,
				improvements: data.improvements.filter(Boolean)
			},
			aiRecommendations
		});
		
		res.status(201).json({ success: true, data: report });
	} catch (e) {
		next(e);
	}
};

const getReports = async (req, res, next) => {
	try {
		const schema = Joi.object({
			childId: Joi.string().optional(),
			period: Joi.string().valid('daily', 'weekly', 'monthly').optional(),
			limit: Joi.number().min(1).max(50).default(10),
			page: Joi.number().min(1).default(1)
		});
		const { childId, period, limit, page } = await schema.validateAsync(req.query);
		
		const query = { parent: req.user.id };
		if (childId) query.child = childId;
		if (period) query.period = period;
		
		const reports = await Report.find(query)
			.populate('child', 'name avatarUrl')
			.sort({ generatedAt: -1 })
			.limit(limit)
			.skip((page - 1) * limit);
		
		const total = await Report.countDocuments(query);
		
		res.json({ 
			success: true, 
			data: { 
				reports, 
				pagination: { 
					total, 
					page, 
					limit, 
					pages: Math.ceil(total / limit) 
				} 
			} 
		});
	} catch (e) {
		next(e);
	}
};

const getReportById = async (req, res, next) => {
	try {
		const report = await Report.findOne({ _id: req.params.id, parent: req.user.id })
			.populate('child', 'name avatarUrl birthdate');
		if (!report) return res.status(404).json({ success: false, message: 'Không tìm thấy báo cáo' });
		res.json({ success: true, data: report });
	} catch (e) {
		next(e);
	}
};

const deleteReport = async (req, res, next) => {
	try {
		const report = await Report.findOneAndDelete({ _id: req.params.id, parent: req.user.id });
		if (!report) return res.status(404).json({ success: false, message: 'Không tìm thấy báo cáo' });
		res.json({ success: true, message: 'Xóa báo cáo thành công' });
	} catch (e) {
		next(e);
	}
};

module.exports = {
	generateReport,
	getReports,
	getReportById,
	deleteReport
};