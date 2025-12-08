const Joi = require('joi');
const Lesson = require('../models/BaiHoc');
const Child = require('../models/TreEm');

const listLessons = async (req, res, next) => {
	try {
		const { danhMuc, capDo, limit = 20, page = 1 } = req.query;
		const filter = { trangThai: true };
		if (danhMuc) filter.danhMuc = danhMuc;
		if (capDo) filter.capDo = capDo;

		if (req.user && req.user.vaiTro === 'hocSinh') {
			const Class = require('../models/Lop');

			// Tìm hồ sơ TreEm tương ứng với tài khoản học sinh
			const child = await Child.findOne({ phuHuynh: req.user.id || req.user._id }).select('_id');

			// Nếu học sinh chưa được tạo hồ sơ / chưa được thêm vào lớp nào → không có quyền xem bài học
			if (!child) {
				return res.json({
					success: true,
					data: {
						lessons: [],
						pagination: {
							total: 0,
							page: parseInt(page),
							limit: parseInt(limit),
							pages: 0
						}
					}
				});
			}

			// Lấy các lớp mà học sinh đang tham gia
			const classes = await Class.find({ hocSinh: child._id }).select('baiTap');
			const lessonIds = Array.from(new Set(
				classes.flatMap(c => (c.baiTap || []).map(id => id.toString()))
			));

			// Nếu lớp không có bài tập nào → trả về rỗng
			if (lessonIds.length === 0) {
				return res.json({
					success: true,
					data: {
						lessons: [],
						pagination: {
							total: 0,
							page: parseInt(page),
							limit: parseInt(limit),
							pages: 0
						}
					}
				});
			}

			filter._id = { $in: lessonIds };
		}

		const lessons = await Lesson.find(filter)
			.populate('lop', 'tenLop maLop')
			.sort({ thuTu: 1 })
			.limit(parseInt(limit))
			.skip((parseInt(page) - 1) * parseInt(limit));
		
		const total = await Lesson.countDocuments(filter);
		
		res.json({ 
			success: true, 
			data: { 
				lessons, 
				pagination: { 
					total, 
					page: parseInt(page), 
					limit: parseInt(limit), 
					pages: Math.ceil(total / parseInt(limit)) 
				} 
			} 
		});
	} catch (e) {
		next(e);
	}
};

const getLessonById = async (req, res, next) => {
	try {
		const lesson = await Lesson.findById(req.params.id)
			.populate('lop', 'tenLop maLop')
			.populate('nguoiTao', 'hoTen email');
		if (!lesson) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
		res.json({ success: true, data: lesson });
	} catch (e) {
		next(e);
	}
};

const getRandomExercises = async (req, res, next) => {
	try {
		const { id: lessonId } = req.params;
		const { count = 5 } = req.query;
		console.log('Getting random exercises for lessonId:', lessonId);
		
		const lesson = await Lesson.findById(lessonId);
		if (!lesson) {
			console.log('Lesson not found for ID:', lessonId);
			return res.status(404).json({ success: false, message: 'Không tìm thấy bài học' });
		}
		
		console.log('Lesson found:', lesson.tieuDe);
		console.log('Lesson content:', JSON.stringify(lesson.noiDung, null, 2));
		
		const exercises = lesson.noiDung?.baiTap || [];
		console.log('Exercises count:', exercises.length);
		
		if (exercises.length === 0) {
			return res.status(400).json({ success: false, message: 'Bài học không có câu hỏi' });
		}
		
		const randomExercises = [];
		const availableExercises = [...exercises];
		const maxCount = Math.min(parseInt(count), availableExercises.length);
		
		for (let i = 0; i < maxCount; i++) {
			const randomIndex = Math.floor(Math.random() * availableExercises.length);
			randomExercises.push(availableExercises[randomIndex]);
			availableExercises.splice(randomIndex, 1);
		}
		
		res.json({ 
			success: true, 
			data: {
				lessonId: lesson._id,
				lessonTitle: lesson.tieuDe,
				exercises: randomExercises,
				totalExercises: exercises.length,
				selectedCount: randomExercises.length
			}
		});
	} catch (e) {
		next(e);
	}
};

const completeLesson = async (req, res, next) => {
	try {
		const schema = Joi.object({ childId: Joi.string().required() });
		const { childId } = await schema.validateAsync(req.body);
		const lesson = await Lesson.findById(req.params.id);
		if (!lesson) return res.status(404).json({ success: false, message: 'Không tìm thấy bài học' });
		const child = await Child.findOne({ _id: childId, parent: req.user.id });
		if (!child) return res.status(404).json({ success: false, message: 'Không tìm thấy trẻ' });
		switch (lesson.danhMuc) {
			case 'chuCai':
				child.progress.lettersCompleted = (child.progress.lettersCompleted || 0) + 1;
				break;
			case 'so':
				child.progress.numbersCompleted = (child.progress.numbersCompleted || 0) + 1;
				break;
			case 'mauSac':
				child.progress.colorsCompleted = (child.progress.colorsCompleted || 0) + 1;
				break;
			case 'hanhDong':
				child.progress.actionsCompleted = (child.progress.actionsCompleted || 0) + 1;
				break;
			default:
				break;
		}
		await child.save();
		res.status(201).json({ success: true, data: child.progress });
	} catch (e) {
		next(e);
	}
};

const createLesson = async (req, res, next) => {
	try {
		const schema = Joi.object({
			tieuDe: Joi.string().required(),
			moTa: Joi.string().optional(),
			danhMuc: Joi.string().valid('chuCai', 'so', 'mauSac', 'hanhDong').required(),
			capDo: Joi.string().valid('coBan', 'trungBinh', 'nangCao').optional(),
			anhDaiDien: Joi.string().optional(), 
			amThanh: Joi.string().optional(), 
			noiDung: Joi.object({
				vanBan: Joi.string().optional(),
				viDu: Joi.array().items(Joi.string()).optional(),
				baiTap: Joi.array().items(Joi.object({
					_id: Joi.string().optional(),
					loai: Joi.string().valid('tracNghiem', 'keoTha', 'ghepDoi', 'toMau', 'dienKhuyet').optional(),
					cauHoi: Joi.string().optional(),
					phuongAn: Joi.array().items(Joi.string()).optional(),
					dapAnDung: Joi.any().optional(),
					anhDaiDien: Joi.string().optional(),
					vanBan: Joi.string().optional(),
					oTrong: Joi.array().items(Joi.object({
						viTri: Joi.number().optional(),
						dapAnDung: Joi.string().optional(),
						phuongAn: Joi.array().items(Joi.string()).optional()
					})).optional()
				})).optional()
			}).optional(),
			thuTu: Joi.number().optional(),
			thoiGianUocTinh: Joi.number().optional(), 
			dieuKienTienQuyet: Joi.array().items(Joi.string()).optional(),
			lop: Joi.array().items(Joi.string()).optional()
		}).unknown(true); 
		const value = await schema.validateAsync(req.body);
		
		if (value.noiDung && value.noiDung.baiTap) {
			value.noiDung.baiTap.forEach(exercise => {
				if (exercise.loai === 'tracNghiem' && exercise.phuongAn) {
					if (exercise.phuongAn && Array.isArray(exercise.phuongAn)) {
						exercise.phuongAn = exercise.phuongAn.map((option, index) => {
							if (typeof option === 'string' && option.includes(': ')) {
								return option;
							}
							const letter = String.fromCharCode(65 + index);
							return option.trim() ? `${letter}: ${option.trim()}` : '';
						}).filter(option => option !== '');
					}
				}
			});
		}
		
		// Thêm nguoiTao nếu có user đăng nhập
		if (req.user) {
			value.nguoiTao = req.user.id || req.user._id;
		}
		
		const lesson = await Lesson.create(value);
		
		// Nếu có lớp, thêm bài học vào lớp
		if (value.lop && value.lop.length > 0) {
			const Class = require('../models/Lop');
			for (const classId of value.lop) {
				await Class.findByIdAndUpdate(classId, { $addToSet: { baiTap: lesson._id } });
			}
		}
		
		res.status(201).json({ success: true, data: lesson });
	} catch (e) {
		console.error('Error creating lesson:', e);
		next(e);
	}
};

const updateLesson = async (req, res, next) => {
	try {
	const schema = Joi.object({ 
			tieuDe: Joi.string(), 
			moTa: Joi.string().optional(),
			danhMuc: Joi.string().valid('chuCai', 'so', 'mauSac', 'hanhDong').optional(),
			capDo: Joi.string().valid('coBan', 'trungBinh', 'nangCao').optional(),
			anhDaiDien: Joi.string().optional(), 
			thoiGianUocTinh: Joi.number().optional(),
			noiDung: Joi.any(), 
			thuTu: Joi.number() 
	});
		const value = await schema.validateAsync(req.body);
		
		if (value.noiDung && value.noiDung.baiTap) {
			value.noiDung.baiTap.forEach(exercise => {
				if (exercise.loai === 'tracNghiem' && exercise.phuongAn && exercise.dapAnDung) {
					if (typeof exercise.dapAnDung === 'string' && exercise.dapAnDung.length === 1) {
						const letterIndex = exercise.dapAnDung.charCodeAt(0) - 65; 
						if (letterIndex >= 0 && letterIndex < exercise.phuongAn.length) {
							exercise.dapAnDung = letterIndex;
						}
					}
				}
			});
		}
		
		const lesson = await Lesson.findByIdAndUpdate(req.params.id, value, { new: true });
		if (!lesson) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
		res.json({ success: true, data: lesson });
	} catch (e) {
		next(e);
	}
};

const deleteLesson = async (req, res, next) => {
	try {
		const lesson = await Lesson.findByIdAndDelete(req.params.id);
		if (!lesson) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
		res.json({ success: true });
	} catch (e) {
		next(e);
	}
};

const getLessonsByCategory = async (req, res, next) => {
	try {
		const { category: danhMuc } = req.params;
		const { level: capDo, limit = 20, page = 1 } = req.query;
		
		const filter = { danhMuc, trangThai: true };
		if (capDo) filter.capDo = capDo;
		
		const lessons = await Lesson.find(filter)
			.sort({ thuTu: 1 })
			.limit(parseInt(limit))
			.skip((parseInt(page) - 1) * parseInt(limit));
		
		const total = await Lesson.countDocuments(filter);
		
		res.json({ 
			success: true, 
			data: { 
				lessons, 
				pagination: { 
					total, 
					page: parseInt(page), 
					limit: parseInt(limit), 
					pages: Math.ceil(total / parseInt(limit)) 
				} 
			} 
		});
	} catch (e) {
		next(e);
	}
};

const getRecommendedLessons = async (req, res, next) => {
	try {
		const { childId } = req.params;
		const child = await Child.findOne({ _id: childId, parent: req.user.id });
		if (!child) return res.status(404).json({ success: false, message: 'Không tìm thấy trẻ' });
		
		const capDo = child.capDoHocTap || 'coBan';
		
		const lessons = await Lesson.find({
			capDo: { $lte: capDo },
			trangThai: true
		})
		.sort({ thuTu: 1 })
		.limit(10);
		
		res.json({ success: true, data: lessons });
	} catch (e) {
		next(e);
	}
};

const searchLessons = async (req, res, next) => {
	try {
		const { q, category, level, limit = 20, page = 1 } = req.query;
		
		const filter = { trangThai: true };
		if (q) {
			filter.$or = [
				{ tieuDe: { $regex: q, $options: 'i' } },
				{ moTa: { $regex: q, $options: 'i' } }
			];
		}
		if (category) filter.danhMuc = category;
		if (level) filter.capDo = level;
		
		const lessons = await Lesson.find(filter)
			.sort({ thuTu: 1 })
			.limit(parseInt(limit))
			.skip((parseInt(page) - 1) * parseInt(limit));
		
		const total = await Lesson.countDocuments(filter);
		
		res.json({ 
			success: true, 
			data: { 
				lessons, 
				pagination: { 
					total, 
					page: parseInt(page), 
					limit: parseInt(limit), 
					pages: Math.ceil(total / parseInt(limit)) 
				} 
			} 
		});
	} catch (e) {
		next(e);
	}
};

const checkLessonCompletion = async (req, res, next) => {
	try {
		const { id: lessonId } = req.params;
		const { childId } = req.params;
		
		const Progress = require('../models/TienDo');
		const progress = await Progress.findOne({ 
			treEm: childId, 
			baiHoc: lessonId, 
			trangThai: 'hoanThanh' 
		}).populate('baiHoc', 'tieuDe danhMuc capDo');
		
		if (progress) {
			res.json({ 
				success: true, 
				data: { 
					completed: true, 
					progress: {
						id: progress._id,
						score: progress.diemSo,
						timeSpent: progress.thoiGianDaDung,
						completedAt: progress.ngayHoanThanh,
						answers: progress.cauTraLoi || [],
						lesson: progress.baiHoc
					}
				} 
			});
		} else {
			res.json({ 
				success: true, 
				data: { 
					completed: false 
				} 
			});
		}
	} catch (e) {
		next(e);
	}
};

const getLessonHistory = async (req, res, next) => {
	try {
		const { childId } = req.params;
		const { limit = 20, page = 1 } = req.query;
		
		const Progress = require('../models/TienDo');
		
		const progress = await Progress.find({ 
			treEm: childId, 
			trangThai: 'hoanThanh',
			loai: 'baiHoc'
		})
		.populate('baiHoc', 'tieuDe danhMuc capDo moTa anhDaiDien')
		.sort({ ngayHoanThanh: -1 })
		.limit(parseInt(limit))
		.skip((parseInt(page) - 1) * parseInt(limit));
		
		const total = await Progress.countDocuments({ 
			treEm: childId, 
			trangThai: 'hoanThanh',
			loai: 'baiHoc'
		});
		
		const responseData = { 
			success: true, 
			data: { 
				history: progress.map(p => ({
					id: p._id,
					lesson: p.baiHoc,
					score: p.diemSo,
					timeSpent: p.thoiGianDaDung,
					completedAt: p.ngayHoanThanh,
					answers: (p.cauTraLoi || []).map(a => ({
						exerciseId: a.idBaiTap,
						answer: a.cauTraLoi,
						isCorrect: a.dung
					}))
				})),
				pagination: { 
					total, 
					page: parseInt(page), 
					limit: parseInt(limit), 
					pages: Math.ceil(total / parseInt(limit)) 
				} 
			} 
		};
		
		res.json(responseData);
	} catch (e) {
		next(e);
	}
};

const getLessonResults = async (req, res, next) => {
	try {
		const { lessonId } = req.params;
		const Class = require('../models/Lop');
		const Progress = require('../models/TienDo');
		
		const lesson = await Lesson.findById(lessonId).populate('lop', 'tenLop maLop');
		if (!lesson) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy bài học' });
		}
		
		if (req.user.vaiTro === 'giaoVien') {
			const teacherClasses = await Class.find({ giaoVien: req.user.id || req.user._id });
			const teacherClassIds = teacherClasses.map(c => c._id.toString());
			const lessonClassIds = (lesson.lop || []).map(c => c._id.toString());
			const hasAccess = lessonClassIds.some(id => teacherClassIds.includes(id));
			
			if (!hasAccess && lesson.nguoiTao?.toString() !== (req.user.id || req.user._id)?.toString()) {
				return res.status(403).json({ success: false, message: 'Bạn không có quyền xem kết quả bài học này' });
			}
		}
		
		const classIds = (lesson.lop || []).map(c => {
			if (typeof c === 'object' && c._id) return c._id;
			return c;
		});
		const allStudents = [];
		
		for (const classId of classIds) {
			const classData = await Class.findById(classId).populate('hocSinh', 'hoTen ngaySinh gioiTinh anhDaiDien');
			if (classData && classData.hocSinh && classData.hocSinh.length > 0) {
				allStudents.push(...classData.hocSinh.map(student => ({
					studentId: student._id,
					studentName: student.hoTen,
					studentAvatar: student.anhDaiDien,
					classId: classId,
					className: classData.tenLop
				})));
			}
		}
		
		const studentIds = allStudents.map(s => s.studentId);
		const submittedProgress = await Progress.find({
			baiHoc: lessonId,
			treEm: { $in: studentIds },
			trangThai: 'hoanThanh',
			loai: 'baiHoc'
		}).populate('treEm', 'hoTen ngaySinh gioiTinh anhDaiDien');
		
		const submittedStudentIds = new Set(submittedProgress.map(p => p.treEm._id.toString()));
		
		const submittedStudents = allStudents
			.filter(s => submittedStudentIds.has(s.studentId.toString()))
			.map(student => {
				const progress = submittedProgress.find(p => p.treEm._id.toString() === student.studentId.toString());
				return {
					studentId: student.studentId,
					studentName: student.studentName,
					studentAvatar: student.studentAvatar,
					classId: student.classId,
					className: student.className,
					score: progress.diemSo || 0,
					timeSpent: progress.thoiGianDaDung || 0,
					completedAt: progress.ngayHoanThanh || progress.updatedAt,
					attempts: progress.soLanThu || 1,
					answers: (progress.cauTraLoi || []).map(answer => ({
						exerciseId: answer.idBaiTap,
						answer: answer.cauTraLoi,
						isCorrect: answer.dung
					}))
				};
			});
		
		const notSubmittedStudents = allStudents.filter(s => !submittedStudentIds.has(s.studentId.toString()));
		
		const exercises = (lesson.noiDung?.baiTap || []).map(ex => ({
			id: ex._id || ex.id,
			question: ex.cauHoi,
			type: ex.loai,
			options: ex.phuongAn || [],
			correctAnswer: ex.dapAnDung,
			image: ex.anhDaiDien,
			vanBan: ex.vanBan
		}));
		
		const submittedStudentsWithDetails = submittedStudents.map(student => {
			const studentAnswers = student.answers || [];
			const answersWithExerciseDetails = studentAnswers.map(answer => {
				const exercise = exercises.find(ex => ex.id === answer.exerciseId);
				return {
					exerciseId: answer.exerciseId,
					exerciseQuestion: exercise?.question || '',
					exerciseType: exercise?.type || '',
					exerciseOptions: exercise?.options || [],
					correctAnswer: exercise?.correctAnswer,
					studentAnswer: answer.answer,
					isCorrect: answer.isCorrect
				};
			});
			
			return {
				studentId: student.studentId,
				studentName: student.studentName,
				studentAvatar: student.studentAvatar,
				classId: student.classId,
				className: student.className,
				score: student.score,
				timeSpent: student.timeSpent,
				completedAt: student.completedAt,
				attempts: student.attempts,
				answers: answersWithExerciseDetails
			};
		});
		
		const notSubmittedStudentsList = notSubmittedStudents.map(student => ({
			studentId: student.studentId,
			studentName: student.studentName,
			studentAvatar: student.studentAvatar,
			classId: student.classId,
			className: student.className
		}));
		
		res.json({
			success: true,
			data: {
				lesson: {
					id: lesson._id,
					title: lesson.tieuDe,
					description: lesson.moTa,
					category: lesson.danhMuc,
					level: lesson.capDo,
					image: lesson.anhDaiDien,
					classes: lesson.lop || []
				},
				exercises: exercises,
				submittedStudents: submittedStudentsWithDetails,
				notSubmittedStudents: notSubmittedStudentsList,
				summary: {
					totalStudents: allStudents.length,
					submittedCount: submittedStudents.length,
					notSubmittedCount: notSubmittedStudents.length,
					averageScore: submittedStudents.length > 0
						? Math.round(submittedStudents.reduce((sum, s) => sum + s.score, 0) / submittedStudents.length)
						: 0
				}
			}
		});
	} catch (e) {
		next(e);
	}
};

module.exports = {
	listLessons,
	getLessonById,
	getRandomExercises,
	completeLesson,
	createLesson,
	updateLesson,
	deleteLesson,
	getLessonsByCategory,
	getRecommendedLessons,
	searchLessons,
	checkLessonCompletion,
	getLessonHistory,
	getLessonResults
};
