const Joi = require('joi');
const Progress = require('../models/TienDo');
const Child = require('../models/TreEm');
const Lesson = require('../models/BaiHoc');
const ClassModel = require('../models/Lop');

const getProgressById = async (req, res, next) => {
	try {
		const progress = await Progress.findById(req.params.id)
			.populate('baiHoc', 'tieuDe danhMuc capDo moTa anhDaiDien noiDung')
			.populate('treEm', 'hoTen ngaySinh phongHoc lop');
		
		if (!progress) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy tiến độ' });
		}
		
		res.json({ success: true, data: progress });
	} catch (e) {
		next(e);
	}
};

const getProgressByChild = async (req, res, next) => {
	try {
		const child = await Child.findOne({ _id: req.params.childId, phuHuynh: req.user.id });
		if (!child) return res.status(404).json({ success: false, message: 'Không tìm thấy trẻ' });
		
		const progress = await Progress.find({ treEm: req.params.childId })
			.populate('baiHoc', 'tieuDe danhMuc capDo')
			.sort({ updatedAt: -1 });
		
		res.json({ success: true, data: progress });
	} catch (e) {
		next(e);
	}
};

const updateProgress = async (req, res, next) => {
	try {
		const schema = Joi.object({
			lessonId: Joi.string().required(),
			trangThai: Joi.string().valid('chuaBatDau', 'dangThucHien', 'hoanThanh').optional(),
			score: Joi.number().min(0).max(100).optional(),
			timeSpent: Joi.number().min(0).optional(),
			notes: Joi.string().optional()
		});
		const updateData = await schema.validateAsync(req.body);
		
		const child = await Child.findOne({ _id: req.params.childId, phuHuynh: req.user.id });
		if (!child) return res.status(404).json({ success: false, message: 'Không tìm thấy trẻ' });
		
		const lesson = await Lesson.findById(updateData.lessonId);
		if (!lesson) return res.status(404).json({ success: false, message: 'Không tìm thấy bài học' });
		
		const progress = await Progress.findOneAndUpdate(
			{ treEm: req.params.childId, baiHoc: updateData.lessonId },
			{
				treEm: req.params.childId,
				baiHoc: updateData.lessonId,
				trangThai: updateData.trangThai || 'dangThucHien',
				diemSo: updateData.score,
				thoiGianDaDung: updateData.timeSpent,
				ngayHoanThanh: updateData.trangThai === 'hoanThanh' ? new Date() : undefined,
				ghiChu: updateData.notes,
				soLanThu: { $inc: 1 }
			},
			{ upsert: true, new: true }
		).populate('baiHoc', 'tieuDe danhMuc capDo');
		
		res.json({ success: true, data: progress });
	} catch (e) {
		next(e);
	}
};

const getProgressStats = async (req, res, next) => {
	try {
		let targetChildId = req.params.childId;
		if (req.user.vaiTro === 'hocSinh') {
			targetChildId = req.user.id;
		} else {
			const child = await Child.findOne({ _id: req.params.childId, phuHuynh: req.user.id });
			if (!child) return res.status(404).json({ success: false, message: 'Không tìm thấy trẻ' });
			targetChildId = child._id;
		}
		
		const stats = await Progress.aggregate([
			{ $match: { treEm: targetChildId } },
			{
				$group: {
					_id: null,
					totalLessons: { $sum: 1 },
					completedLessons: { $sum: { $cond: [{ $eq: ['$trangThai', 'hoanThanh'] }, 1, 0] } },
					inProgressLessons: { $sum: { $cond: [{ $eq: ['$trangThai', 'dangThucHien'] }, 1, 0] } },
					averageScore: { $avg: '$diemSo' },
					totalTimeSpent: { $sum: '$thoiGianDaDung' }
				}
			},
			{
				$addFields: {
					completionRate: {
						$cond: [
							{ $gt: ['$totalLessons', 0] },
							{ $multiply: [{ $divide: ['$completedLessons', '$totalLessons'] }, 100] },
							0
						]
					}
				}
			}
		]);
		
		const categoryStats = await Progress.aggregate([
			{ $match: { treEm: targetChildId } },
			{
				$lookup: {
					from: 'baihocs',
					localField: 'baiHoc',
					foreignField: '_id',
					as: 'lessonData'
				}
			},
			{ $unwind: '$lessonData' },
			{
				$group: {
					_id: '$lessonData.danhMuc',
					total: { $sum: 1 },
					completed: { $sum: { $cond: [{ $eq: ['$trangThai', 'hoanThanh'] }, 1, 0] } },
					averageScore: { $avg: '$diemSo' }
				}
			}
		]);
		
		res.json({ 
			success: true, 
			data: { 
				overall: stats[0] || { totalLessons: 0, completedLessons: 0, inProgressLessons: 0, averageScore: 0, totalTimeSpent: 0, completionRate: 0 },
				byCategory: categoryStats
			}
		});
	} catch (e) {
		next(e);
	}
};

const getRecentProgress = async (req, res, next) => {
	try {
		let targetChildId = req.params.childId;
		if (req.user.vaiTro === 'hocSinh') {
			targetChildId = req.user.id;
		} else {
			const child = await Child.findOne({ _id: req.params.childId, phuHuynh: req.user.id });
			if (!child) return res.status(404).json({ success: false, message: 'Không tìm thấy trẻ' });
			targetChildId = child._id;
		}
		
		const recentProgress = await Progress.find({ treEm: targetChildId })
			.populate('lesson', 'tieuDe danhMuc capDo')
			.sort({ updatedAt: -1 })
			.limit(10);
		
		res.json({ success: true, data: recentProgress });
	} catch (e) {
		next(e);
	}
};

const recordGameResult = async (req, res, next) => {
	try {
		const schema = Joi.object({
			gameId: Joi.string().required(),
			score: Joi.number().min(0).max(100).required(),
			timeSpent: Joi.number().min(0).optional(),
			answers: Joi.array().items(Joi.object({
				questionId: Joi.string().required(),
				answer: Joi.string().required(),
				isCorrect: Joi.boolean().required()
			})).optional(),
			achievements: Joi.array().items(Joi.string()).optional()
		});

		const { gameId, score, timeSpent, answers, achievements } = await schema.validateAsync(req.body);
		const childId = req.user.vaiTro === 'hocSinh' ? req.user.id : req.body.childId;
		
		if (!childId) {
			return res.status(400).json({ success: false, message: 'Child ID is required' });
		}

		const progress = await Progress.create({
			treEm: childId,
			troChoi: gameId,
			loai: 'troChoi',
			trangThai: 'hoanThanh',
			diemSo: score,
			thoiGianDaDung: timeSpent || 0,
			ngayHoanThanh: new Date(),
			cauTraLoi: (answers || []).map(a => ({
				idBaiTap: a.questionId,
				cauTraLoi: a.answer,
				dung: a.isCorrect
			})),
			soLanThu: 1
		});

		const newAchievements = [];
		if (score >= 90) newAchievements.push('excellent');
		if (score >= 80) newAchievements.push('good');
		if (score >= 70) newAchievements.push('pass');
		if (timeSpent && timeSpent < 60) newAchievements.push('fast');

		res.json({
			success: true,
			data: {
				progress,
				achievements: newAchievements,
				message: score >= 80 ? 'Tuyệt vời!' : score >= 60 ? 'Tốt lắm!' : 'Cố gắng thêm nhé!'
			}
		});
	} catch (e) {
		next(e);
	}
};

const recordLessonResult = async (req, res, next) => {
	try {
		const schema = Joi.object({
			lessonId: Joi.string().required(),
			childId: Joi.string().optional(), 
			score: Joi.number().min(0).max(100).required(),
			timeSpent: Joi.number().min(0).optional(),
			answers: Joi.array().items(Joi.object({
				exerciseId: Joi.string().required(),
				answer: Joi.string().required(),
				isCorrect: Joi.boolean().required()
			})).optional()
		});

		const { lessonId, score, timeSpent, answers } = await schema.validateAsync(req.body);
		
		const childId = req.user.vaiTro === 'hocSinh' ? req.user.id : req.body.childId;
		
		const processedAnswers = answers;
		
		if (!childId) {
			return res.status(400).json({ success: false, message: 'Child ID is required' });
		}

		const existingProgress = await Progress.findOne({
			treEm: childId,
			baiHoc: lessonId,
			loai: 'baiHoc'
		});

		let progress;
		if (existingProgress) {
			progress = await Progress.findByIdAndUpdate(existingProgress._id, {
				loai: 'baiHoc',
				trangThai: 'hoanThanh',
				diemSo: score,
				thoiGianDaDung: timeSpent || 0,
				ngayHoanThanh: new Date(),
				cauTraLoi: (processedAnswers || []).map(a => ({
					idBaiTap: a.exerciseId,
					cauTraLoi: a.answer,
					dung: a.isCorrect
				})),
				soLanThu: (existingProgress.soLanThu || 0) + 1
			}, { new: true });
		} else {
			progress = await Progress.create({
				treEm: childId,
				baiHoc: lessonId,
				loai: 'baiHoc',
				trangThai: 'hoanThanh',
				diemSo: score,
				thoiGianDaDung: timeSpent || 0,
				ngayHoanThanh: new Date(),
				cauTraLoi: (processedAnswers || []).map(a => ({
					idBaiTap: a.exerciseId,
					cauTraLoi: a.answer,
					dung: a.isCorrect
				})),
				soLanThu: 1
			});
		}
		
		const newAchievements = [];
		if (score >= 90) newAchievements.push('excellent');
		if (score >= 80) newAchievements.push('good');
		if (score >= 70) newAchievements.push('pass');

		res.json({
			success: true,
			data: {
				progress,
				achievements: newAchievements,
				message: score >= 80 ? 'Tuyệt vời!' : score >= 60 ? 'Tốt lắm!' : 'Cố gắng thêm nhé!'
			}
		});
	} catch (e) {
		next(e);
	}
};

const getChildAchievements = async (req, res, next) => {
	try {
		const { childId } = req.params;
		
		let targetChildId = childId;
		if (req.user.vaiTro === 'hocSinh') {
			targetChildId = req.user.id;
		} else {
			const child = await Child.findById(childId);
			if (!child) {
				return res.status(404).json({ success: false, message: 'Child not found' });
			}
			targetChildId = child._id;
		}

		const achievements = await Progress.aggregate([
			{ $match: { treEm: targetChildId, trangThai: 'hoanThanh' } },
			{
				$group: {
					_id: null,
					totalActivities: { $sum: 1 },
					averageScore: { $avg: '$diemSo' },
					excellentCount: { $sum: { $cond: [{ $gte: ['$diemSo', 90] }, 1, 0] } },
					goodCount: { $sum: { $cond: [{ $gte: ['$diemSo', 80] }, 1, 0] } },
					passCount: { $sum: { $cond: [{ $gte: ['$diemSo', 70] }, 1, 0] } },
					totalTimeSpent: { $sum: '$thoiGianDaDung' }
				}
			}
		]);

		const stats = achievements[0] || {
			totalActivities: 0,
			averageScore: 0,
			excellentCount: 0,
			goodCount: 0,
			passCount: 0,
			totalTimeSpent: 0
		};

		const badges = [];
		if (stats.excellentCount >= 10) badges.push({ name: 'Học giỏi', icon: 'trophy', color: '#FFD700' });
		if (stats.goodCount >= 20) badges.push({ name: 'Chăm chỉ', icon: 'star', color: '#FF6B6B' });
		if (stats.totalActivities >= 50) badges.push({ name: 'Kiên trì', icon: 'medal', color: '#4ECDC4' });
		if (stats.averageScore >= 85) badges.push({ name: 'Xuất sắc', icon: 'crown', color: '#9C27B0' });

		res.json({
			success: true,
			data: {
				stats,
				badges,
				recentAchievements: badges.slice(0, 3) 
			}
		});
	} catch (e) {
		next(e);
	}
};

const getChildDetailReport = async (req, res, next) => {
	try {
		const { childId } = req.params;
		
		const child = await Child.findOne({ _id: childId, phuHuynh: req.user.id });
		if (!child) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy trẻ' });
		}

		const classes = await ClassModel.find({ hocSinh: child._id })
			.select('tenLop moTa');
		
		const progressList = await Progress.find({ treEm: child._id, loai: 'baiHoc' })
			.populate({
				path: 'baiHoc',
				select: 'tieuDe danhMuc capDo moTa noiDung lop'
			})
			.sort({ updatedAt: -1 });

		const classReportsMap = new Map();

		classes.forEach(cls => {
			classReportsMap.set(cls._id.toString(), {
				classId: cls._id,
				className: cls.tenLop,
				classDescription: cls.moTa,
				lessons: []
			});
		});

		const ensureClassEntry = (classId, className = 'Bài học cá nhân') => {
			if (!classReportsMap.has(classId)) {
				classReportsMap.set(classId, {
					classId,
					className,
					classDescription: classId === 'others' ? 'Các bài học không thuộc lớp cụ thể' : '',
					lessons: []
				});
			}
			return classReportsMap.get(classId);
		};

		progressList.forEach(progress => {
			if (!progress.baiHoc) return;
			
			const lesson = progress.baiHoc;
			const classId = lesson.lop ? lesson.lop.toString() : 'others';
			const classEntry = ensureClassEntry(classId, classes.find(c => c._id.toString() === classId)?.tenLop || 'Bài học cá nhân');

			const questionBank = (lesson.noiDung && Array.isArray(lesson.noiDung.baiTap))
				? lesson.noiDung.baiTap.map(q => ({
					id: q._id,
					question: q.cauHoi,
					options: q.phuongAn || [],
					correctAnswer: q.dapAnDung
				}))
				: [];

			classEntry.lessons.push({
				lessonId: lesson._id,
				title: lesson.tieuDe,
				category: lesson.danhMuc,
				level: lesson.capDo,
				description: lesson.moTa,
				status: progress.trangThai || 'hoanThanh',
				score: progress.diemSo || 0,
				timeSpent: progress.thoiGianDaDung || 0,
				completedAt: progress.ngayHoanThanh || progress.updatedAt,
				attempts: progress.soLanThu || 1,
				answers: (progress.cauTraLoi || []).map(answer => ({
					questionId: answer.idBaiTap,
					answer: answer.cauTraLoi,
					isCorrect: answer.dung
				})),
				questions: questionBank
			});
		});

		const classReports = Array.from(classReportsMap.values());
		
		res.json({
			success: true,
			data: {
				child: {
					id: child._id,
					name: child.hoTen,
					classCount: classReports.length
				},
				classes: classReports
			}
		});
	} catch (e) {
		next(e);
	}
};

module.exports = {
	getProgressById,
	getProgressByChild,
	updateProgress,
	getProgressStats,
	getRecentProgress,
	recordGameResult,
	recordLessonResult,
	getChildAchievements,
	getChildDetailReport
};
