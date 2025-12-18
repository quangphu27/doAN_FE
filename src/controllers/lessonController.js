const Joi = require('joi');
const Lesson = require('../models/BaiHoc');
const Child = require('../models/TreEm');
const User = require('../models/NguoiDung');
const Progress = require('../models/TienDo');
const path = require('path');
const { generateItemResultReportPdf } = require('../utils/pdfReportGenerator');
const { sendReportEmail } = require('../services/emailService');

const listLessons = async (req, res, next) => {
	try {
		const { danhMuc, capDo, limit = 20, page = 1, childId } = req.query;
		const filter = { trangThai: true };
		if (danhMuc) filter.danhMuc = danhMuc;
		if (capDo) filter.capDo = capDo;

	let child = null;

	if (req.user && req.user.vaiTro === 'hocSinh') {
		const Class = require('../models/Lop');

		console.log('[listLessons] user:', req.user?.id || req.user?._id, 'query childId:', childId);
		child = await Child.findOne({
			$or: [
				{ phuHuynh: req.user.id || req.user._id },
				{ _id: childId }
			]
		}).select('_id');
		console.log('[listLessons] resolved child:', child?._id);

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
			console.log('[listLessons] classes count:', classes.length, 'lessonIds:', lessonIds);

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

		let lessons = await Lesson.find(filter)
			.populate('lop', 'tenLop maLop')
			.sort({ thuTu: 1 })
			.limit(parseInt(limit))
			.skip((parseInt(page) - 1) * parseInt(limit));

		if (req.user && req.user.vaiTro === 'hocSinh' && lessons.length > 0 && child) {
			const lessonIds = lessons.map(lesson => lesson._id);
			try {
				const doneLessons = await Progress.find({
					treEm: child._id,
					baiHoc: { $in: lessonIds },
					loai: 'baiHoc',
					trangThai: 'hoanThanh'
				}).select('baiHoc');

				const completedSet = new Set(doneLessons.map(p => p.baiHoc.toString()));
				console.log('[listLessons] doneLessons:', doneLessons.map(d => d.baiHoc?.toString()));
				lessons = lessons.filter(lesson => !completedSet.has(lesson._id.toString()));
			} catch (progressErr) {
				console.error('[listLessons] progress query error:', progressErr);
			}
		}
		
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
		console.error('[listLessons] error:', e);
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
		let targetChildId = childId;
		
		const Progress = require('../models/TienDo');
		const childDoc = await Child.findById(childId).select('_id');
		if (!childDoc) {
			const fallbackChild = await Child.findOne({ phuHuynh: childId }).select('_id');
			if (fallbackChild) {
				targetChildId = fallbackChild._id;
			} else {
				return res.json({
					success: true,
					data: {
						history: [],
						pagination: {
							total: 0,
							page: parseInt(page),
							limit: parseInt(limit),
							pages: 0
						}
					}
				});
			}
		}
		
		const progress = await Progress.find({ 
			treEm: targetChildId, 
			trangThai: 'hoanThanh',
			loai: 'baiHoc'
		})
		.populate('baiHoc', 'tieuDe danhMuc capDo moTa anhDaiDien')
		.sort({ ngayHoanThanh: -1 })
		.limit(parseInt(limit))
		.skip((parseInt(page) - 1) * parseInt(limit));
		
		const total = await Progress.countDocuments({ 
			treEm: targetChildId, 
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
		
		const exerciseMap = new Map();
		let exerciseCounter = 1;

		const addExerciseToMap = (id, text, correct) => {
			if (!id) return;
			const key = id.toString();
			const label = `Câu ${exerciseCounter}`;
			exerciseMap.set(key, {
				label,
				text: text || label,
				correctAnswer: correct
			});
			exerciseCounter += 1;
		};

		const exercises = (lesson.noiDung?.baiTap || []).map(ex => {
			const exId = ex._id || ex.id;
			addExerciseToMap(exId, ex.cauHoi, ex.dapAnDung);
			return {
				id: exId,
				question: ex.cauHoi,
				type: ex.loai,
				options: ex.phuongAn || [],
				correctAnswer: ex.dapAnDung,
				image: ex.anhDaiDien
			};
		});

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
					answers: (progress.cauTraLoi || []).map((answer, idx) => {
						const exInfo = exerciseMap.get(answer.idBaiTap);
						const fallbackLabel = `Câu ${idx + 1}`;
						return {
							exerciseId: answer.idBaiTap, // giữ id kỹ thuật
							displayId: exInfo?.label || fallbackLabel,
							questionLabel: exInfo?.label || fallbackLabel,
							questionText: exInfo?.text || '',
							correctAnswer: exInfo?.correctAnswer || '',
							answer: answer.cauTraLoi,
							isCorrect: answer.dung
						};
					})
				};
			});
		
		const notSubmittedStudents = allStudents.filter(s => !submittedStudentIds.has(s.studentId.toString()));
		
		res.json({
			success: true,
			data: {
				lesson: {
					id: lesson._id,
					title: lesson.tieuDe,
					description: lesson.moTa,
					category: lesson.danhMuc,
					level: lesson.capDo,
					classes: lesson.lop || []
				},
				exercises: exercises,
				submittedStudents: submittedStudents,
				notSubmittedStudents: notSubmittedStudents,
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

const exportLessonResultsReport = async (req, res, next) => {
	try {
		const { lessonId } = req.params;
		const Class = require('../models/Lop');

		if (!req.user || req.user.vaiTro !== 'giaoVien') {
			return res.status(403).json({
				success: false,
				message: 'Chỉ giáo viên mới được xuất báo cáo kết quả bài học'
			});
		}

		const teacher = await User.findById(req.user.id || req.user._id).select('email hoTen');
		const lesson = await Lesson.findById(lessonId).populate('lop', 'tenLop maLop giaoVien hocSinh');
		if (!lesson) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy bài học' });
		}

		const teacherClasses = await Class.find({ giaoVien: req.user.id || req.user._id }).select('_id');
		const teacherClassIds = teacherClasses.map(c => c._id.toString());
		const lessonClassIds = (lesson.lop || []).map(c => (c._id || c).toString());
		const hasAccess = lessonClassIds.some(id => teacherClassIds.includes(id));

		if (!hasAccess && lesson.nguoiTao?.toString() !== (req.user.id || req.user._id)?.toString()) {
			return res.status(403).json({
				success: false,
				message: 'Bạn không có quyền xem kết quả bài học này'
			});
		}

		const ClassModel = require('../models/Lop');
		const allStudents = [];
		for (const classId of lessonClassIds) {
			const classData = await ClassModel.findById(classId).populate('hocSinh', 'hoTen');
			if (classData && classData.hocSinh && classData.hocSinh.length > 0) {
				allStudents.push(...classData.hocSinh.map(student => ({
					studentId: student._id,
					studentName: student.hoTen,
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
		}).populate('treEm', 'hoTen');

		const submittedMap = new Map(
			submittedProgress.map(p => [p.treEm._id.toString(), p])
		);

		const submittedStudents = allStudents
			.filter(s => submittedMap.has(s.studentId.toString()))
			.map(s => {
				const p = submittedMap.get(s.studentId.toString());
				return {
					studentName: s.studentName,
					className: s.className,
					score: p.diemSo || 0,
					teacherScore: typeof p.diemGiaoVien === 'number' ? p.diemGiaoVien : null,
					timeSpent: p.thoiGianDaDung || 0
				};
			});

		const summary = {
			totalStudents: allStudents.length,
			submittedCount: submittedStudents.length,
			notSubmittedCount: allStudents.length - submittedStudents.length,
			averageScore: submittedStudents.length > 0
				? Math.round(submittedStudents.reduce((sum, s) => sum + (s.score || 0), 0) / submittedStudents.length)
				: 0
		};

		const outputDir = path.join(__dirname, '..', '..', 'uploads', 'reports');
		const { filePath, fileName } = await generateItemResultReportPdf({
			item: {
				title: lesson.tieuDe || 'Bài học',
				description: lesson.moTa || '',
				type: 'Bài học',
				category: lesson.danhMuc || ''
			},
			summary,
			results: submittedStudents,
			outputDir
		});

		res.json({
			success: true,
			data: {
				message: 'Đã tạo file báo cáo PDF',
				fileName,
				fileUrl: `/uploads/reports/${fileName}`
			}
		});
	} catch (e) {
		next(e);
	}
};

// Giáo viên gửi báo cáo PDF kết quả bài học về email (có thể tạo lại file)
const sendLessonResultsReportEmail = async (req, res, next) => {
	try {
		const { lessonId } = req.params;
		const Class = require('../models/Lop');

		if (!req.user || req.user.vaiTro !== 'giaoVien') {
			return res.status(403).json({
				success: false,
				message: 'Chỉ giáo viên mới được gửi báo cáo kết quả bài học'
			});
		}

		const teacher = await User.findById(req.user.id || req.user._id).select('email hoTen');
		if (!teacher || !teacher.email) {
			return res.status(400).json({
				success: false,
				message: 'Tài khoản giáo viên chưa có email, không thể gửi báo cáo'
			});
		}

		const lesson = await Lesson.findById(lessonId).populate('lop', 'tenLop maLop giaoVien hocSinh');
		if (!lesson) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy bài học' });
		}

		const teacherClasses = await Class.find({ giaoVien: req.user.id || req.user._id }).select('_id');
		const teacherClassIds = teacherClasses.map(c => c._id.toString());
		const lessonClassIds = (lesson.lop || []).map(c => (c._id || c).toString());
		const hasAccess = lessonClassIds.some(id => teacherClassIds.includes(id));

		if (!hasAccess && lesson.nguoiTao?.toString() !== (req.user.id || req.user._id)?.toString()) {
			return res.status(403).json({
				success: false,
				message: 'Bạn không có quyền xem kết quả bài học này'
			});
		}

		const ClassModel = require('../models/Lop');
		const allStudents = [];
		for (const classId of lessonClassIds) {
			const classData = await ClassModel.findById(classId).populate('hocSinh', 'hoTen');
			if (classData && classData.hocSinh && classData.hocSinh.length > 0) {
				allStudents.push(...classData.hocSinh.map(student => ({
					studentId: student._id,
					studentName: student.hoTen,
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
		}).populate('treEm', 'hoTen');

		const submittedMap = new Map(
			submittedProgress.map(p => [p.treEm._id.toString(), p])
		);

		const submittedStudents = allStudents
			.filter(s => submittedMap.has(s.studentId.toString()))
			.map(s => {
				const p = submittedMap.get(s.studentId.toString());
				return {
					studentName: s.studentName,
					className: s.className,
					score: p.diemSo || 0,
					teacherScore: typeof p.diemGiaoVien === 'number' ? p.diemGiaoVien : null,
					timeSpent: p.thoiGianDaDung || 0
				};
			});

		const summary = {
			totalStudents: allStudents.length,
			submittedCount: submittedStudents.length,
			notSubmittedCount: allStudents.length - submittedStudents.length,
			averageScore: submittedStudents.length > 0
				? Math.round(submittedStudents.reduce((sum, s) => sum + (s.score || 0), 0) / submittedStudents.length)
				: 0
		};

		const outputDir = path.join(__dirname, '..', '..', 'uploads', 'reports');
		const { filePath, fileName } = await generateItemResultReportPdf({
			item: {
				title: lesson.tieuDe || 'Bài học',
				description: lesson.moTa || '',
				type: 'Bài học',
				category: lesson.danhMuc || ''
			},
			summary,
			results: submittedStudents,
			outputDir
		});

		await sendReportEmail({
			to: teacher.email,
			subject: `Báo cáo kết quả bài học: ${lesson.tieuDe || ''}`,
			html: `
				<p>Xin chào ${teacher.hoTen || 'thầy/cô'},</p>
				<p>Hệ thống gửi kèm báo cáo kết quả bài học <strong>${lesson.tieuDe || ''}</strong>.</p>
				<ul>
					<li>Tổng số học sinh: ${summary.totalStudents}</li>
					<li>Đã nộp: ${summary.submittedCount}</li>
					<li>Chưa nộp: ${summary.notSubmittedCount}</li>
					<li>Điểm trung bình: ${summary.averageScore}%</li>
				</ul>
				<p>Trân trọng.</p>
			`,
			pdfPath: filePath,
			pdfName: fileName
		});

		res.json({
			success: true,
			data: {
				message: 'Đã tạo và gửi báo cáo PDF tới email giáo viên',
				fileName
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
	getLessonResults,
	exportLessonResultsReport,
	sendLessonResultsReportEmail
};
