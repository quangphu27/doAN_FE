const Joi = require('joi');
const Class = require('../models/Lop');
const User = require('../models/NguoiDung');
const Child = require('../models/TreEm');
const Lesson = require('../models/BaiHoc');
const Game = require('../models/TroChoi');
const Progress = require('../models/TienDo');

const listClasses = async (req, res, next) => {
	try {
		const { page = 1, limit = 20, search } = req.query;
		const filter = { trangThai: true };
		
		if (req.user.vaiTro === 'giaoVien') {
			filter.giaoVien = req.user.id || req.user._id;
		}
		
		if (search) {
			filter.$or = [
				{ tenLop: { $regex: search, $options: 'i' } },
				{ maLop: { $regex: search, $options: 'i' } }
			];
		}
		
		const classes = await Class.find(filter)
			.populate('giaoVien', 'hoTen email')
			.populate('hocSinh', 'hoTen ngaySinh gioiTinh')
			.populate('baiTap', 'tieuDe danhMuc capDo')
			.populate('troChoi', 'tieuDe loai danhMuc')
			.sort({ createdAt: -1 })
			.limit(parseInt(limit))
			.skip((parseInt(page) - 1) * parseInt(limit));
		
		const total = await Class.countDocuments(filter);
		
		res.json({
			success: true,
			data: {
				classes,
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

const getClassById = async (req, res, next) => {
	try {
		const classId = req.params.id;
		const filter = { _id: classId, trangThai: true };
		
		if (req.user.vaiTro === 'giaoVien') {
			filter.giaoVien = req.user.id || req.user._id;
		}
		
		const classData = await Class.findOne(filter)
			.populate('giaoVien', 'hoTen email')
			.populate('hocSinh', 'hoTen ngaySinh gioiTinh anhDaiDien')
			.populate('baiTap', 'tieuDe danhMuc capDo moTa')
			.populate('troChoi', 'tieuDe loai danhMuc moTa');
		
		if (!classData) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy lớp' });
		}
		
		res.json({ success: true, data: classData });
	} catch (e) {
		next(e);
	}
};

const createClass = async (req, res, next) => {
	try {
		const schema = Joi.object({
			tenLop: Joi.string().required(),
			moTa: Joi.string().optional(),
			emailGiaoVien: Joi.string().email().required(),
			baiTap: Joi.array().items(Joi.string()).optional(),
			troChoi: Joi.array().items(Joi.string()).optional()
		});
		
		const value = await schema.validateAsync(req.body);
		
		const teacher = await User.findOne({ email: value.emailGiaoVien, vaiTro: 'giaoVien' });
		if (!teacher) {
			return res.status(400).json({ success: false, message: 'Không tìm thấy giáo viên với email này' });
		}
		
		const classData = {
			tenLop: value.tenLop,
			moTa: value.moTa,
			giaoVien: teacher._id,
			baiTap: value.baiTap || [],
			troChoi: value.troChoi || []
		};
		
		const newClass = await Class.create(classData);
		
		const populatedClass = await Class.findById(newClass._id)
			.populate('giaoVien', 'hoTen email')
			.populate('hocSinh', 'hoTen ngaySinh gioiTinh')
			.populate('baiTap', 'tieuDe danhMuc capDo')
			.populate('troChoi', 'tieuDe loai danhMuc');
		
		res.status(201).json({ success: true, data: populatedClass });
	} catch (e) {
		next(e);
	}
};

const updateClass = async (req, res, next) => {
	try {
		const schema = Joi.object({
			tenLop: Joi.string().optional(),
			moTa: Joi.string().optional(),
			baiTap: Joi.array().items(Joi.string()).optional(),
			troChoi: Joi.array().items(Joi.string()).optional(),
			trangThai: Joi.boolean().optional()
		});
		
		const value = await schema.validateAsync(req.body);
		const classId = req.params.id;
		
		const filter = { _id: classId };
		if (req.user.vaiTro === 'giaoVien') {
			filter.giaoVien = req.user.id || req.user._id;
		}
		
		const classData = await Class.findOneAndUpdate(filter, value, { new: true })
			.populate('giaoVien', 'hoTen email')
			.populate('hocSinh', 'hoTen ngaySinh gioiTinh')
			.populate('baiTap', 'tieuDe danhMuc capDo')
			.populate('troChoi', 'tieuDe loai danhMuc');
		
		if (!classData) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy lớp' });
		}
		
		res.json({ success: true, data: classData });
	} catch (e) {
		next(e);
	}
};

const deleteClass = async (req, res, next) => {
	try {
		const classId = req.params.id;
		
		const filter = { _id: classId };
		if (req.user.vaiTro === 'giaoVien') {
			filter.giaoVien = req.user.id || req.user._id;
		}
		
		const classData = await Class.findOneAndDelete(filter);
		
		if (!classData) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy lớp' });
		}
		
		res.json({ success: true, message: 'Đã xóa lớp' });
	} catch (e) {
		next(e);
	}
};

const addTeacher = async (req, res, next) => {
	try {
		const schema = Joi.object({
			emailGiaoVien: Joi.string().email().required()
		});
		
		const value = await schema.validateAsync(req.body);
		const classId = req.params.id;
		
		const teacher = await User.findOne({ email: value.emailGiaoVien, vaiTro: 'giaoVien' });
		if (!teacher) {
			return res.status(400).json({ success: false, message: 'Không tìm thấy giáo viên với email này' });
		}
		
		const classData = await Class.findByIdAndUpdate(
			classId,
			{ giaoVien: teacher._id },
			{ new: true }
		)
			.populate('giaoVien', 'hoTen email')
			.populate('hocSinh', 'hoTen ngaySinh gioiTinh')
			.populate('baiTap', 'tieuDe danhMuc capDo')
			.populate('troChoi', 'tieuDe loai danhMuc');
		
		if (!classData) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy lớp' });
		}
		
		res.json({ success: true, data: classData });
	} catch (e) {
		next(e);
	}
};

const addStudent = async (req, res, next) => {
	try {
		const schema = Joi.object({
			emailHocSinh: Joi.string().email().required()
		});
		
		const value = await schema.validateAsync(req.body);
		const classId = req.params.id;
		
		const classData = await Class.findById(classId);
		if (!classData) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy lớp' });
		}
		
		const userId = req.user.id || req.user._id;
		if (req.user.vaiTro === 'giaoVien' && classData.giaoVien.toString() !== userId.toString()) {
			return res.status(403).json({ success: false, message: 'Bạn không có quyền thêm học sinh vào lớp này' });
		}
		
		const studentUser = await User.findOne({ email: value.emailHocSinh, vaiTro: 'hocSinh' });
		if (!studentUser) {
			return res.status(400).json({ success: false, message: 'Không tìm thấy học sinh với email này' });
		}
		
		let child = await Child.findOne({ phuHuynh: studentUser._id });
		if (!child) {
			child = await Child.create({
				hoTen: studentUser.hoTen,
				phuHuynh: studentUser._id,
				gioiTinh: studentUser.thongTinCaNhan?.gioiTinh || 'nam',
				ngaySinh: studentUser.thongTinCaNhan?.ngaySinh,
				capDoHocTap: 'coBan',
				trangThai: true
			});
		}
		
		if (classData.hocSinh.includes(child._id)) {
			return res.status(400).json({ success: false, message: 'Học sinh đã có trong lớp' });
		}
		
		classData.hocSinh.push(child._id);
		await classData.save();
		
		await Child.findByIdAndUpdate(child._id, { phongHoc: classData.tenLop });
		
		const populatedClass = await Class.findById(classId)
			.populate('giaoVien', 'hoTen email')
			.populate('hocSinh', 'hoTen ngaySinh gioiTinh anhDaiDien')
			.populate('baiTap', 'tieuDe danhMuc capDo')
			.populate('troChoi', 'tieuDe loai danhMuc');
		
		res.json({ success: true, data: populatedClass });
	} catch (e) {
		next(e);
	}
};

const removeStudent = async (req, res, next) => {
	try {
		const classId = req.params.id;
		const studentId = req.params.studentId;
		
		const classData = await Class.findById(classId);
		if (!classData) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy lớp' });
		}
		
		const userId = req.user.id || req.user._id;
		if (req.user.vaiTro === 'giaoVien' && classData.giaoVien.toString() !== userId.toString()) {
			return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa học sinh khỏi lớp này' });
		}
		
		classData.hocSinh = classData.hocSinh.filter(id => id.toString() !== studentId);
		await classData.save();
		
		await Child.findByIdAndUpdate(studentId, { $unset: { phongHoc: 1 } });
		
		const populatedClass = await Class.findById(classId)
			.populate('giaoVien', 'hoTen email')
			.populate('hocSinh', 'hoTen ngaySinh gioiTinh anhDaiDien')
			.populate('baiTap', 'tieuDe danhMuc capDo')
			.populate('troChoi', 'tieuDe loai danhMuc');
		
		res.json({ success: true, data: populatedClass });
	} catch (e) {
		next(e);
	}
};

const getClassProgress = async (req, res, next) => {
	try {
		const classId = req.params.id;
		
		const classData = await Class.findById(classId)
			.populate('hocSinh', 'hoTen ngaySinh gioiTinh');
		
		if (!classData) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy lớp' });
		}
		
		const userId = req.user.id || req.user._id;
		if (req.user.vaiTro === 'giaoVien' && classData.giaoVien.toString() !== userId.toString()) {
			return res.status(403).json({ success: false, message: 'Bạn không có quyền xem kết quả lớp này' });
		}
		
		const studentIds = classData.hocSinh.map(s => s._id);
		
		const progress = await Progress.find({
			treEm: { $in: studentIds },
			trangThai: 'hoanThanh'
		})
			.populate('treEm', 'hoTen phongHoc')
			.populate('baiHoc', 'tieuDe danhMuc capDo')
			.populate('troChoi', 'tieuDe loai danhMuc')
			.sort({ ngayHoanThanh: -1 });
		
		const studentProgress = studentIds.map(studentId => {
			const student = classData.hocSinh.find(s => s._id.toString() === studentId.toString());
			const studentProgressData = progress.filter(p => p.treEm._id.toString() === studentId.toString());
			
			return {
				student: {
					id: student._id,
					hoTen: student.hoTen,
					ngaySinh: student.ngaySinh,
					gioiTinh: student.gioiTinh
				},
				progress: studentProgressData.map(p => ({
					id: p._id,
					baiHoc: p.baiHoc,
					troChoi: p.troChoi,
					diemSo: p.diemSo,
					thoiGianDaDung: p.thoiGianDaDung,
					ngayHoanThanh: p.ngayHoanThanh,
					loai: p.loai
				})),
				totalCompleted: studentProgressData.length,
				averageScore: studentProgressData.length > 0
					? Math.round(studentProgressData.reduce((sum, p) => sum + p.diemSo, 0) / studentProgressData.length)
					: 0
			};
		});
		
		res.json({
			success: true,
			data: {
				class: {
					id: classData._id,
					tenLop: classData.tenLop,
					moTa: classData.moTa
				},
				students: studentProgress
			}
		});
	} catch (e) {
		next(e);
	}
};

const getStudentProgress = async (req, res, next) => {
	try {
		const classId = req.params.id;
		const studentId = req.params.studentId;
		
		const classData = await Class.findById(classId);
		if (!classData) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy lớp' });
		}
		
		const userId = req.user.id || req.user._id;
		if (req.user.vaiTro === 'giaoVien' && classData.giaoVien.toString() !== userId.toString()) {
			return res.status(403).json({ success: false, message: 'Bạn không có quyền xem kết quả học sinh này' });
		}
		
		if (!classData.hocSinh.includes(studentId)) {
			return res.status(400).json({ success: false, message: 'Học sinh không thuộc lớp này' });
		}
		
		const progress = await Progress.find({
			treEm: studentId,
			trangThai: 'hoanThanh'
		})
			.populate('baiHoc', 'tieuDe danhMuc capDo moTa')
			.populate('troChoi', 'tieuDe loai danhMuc moTa')
			.sort({ ngayHoanThanh: -1 });
		
		const student = await Child.findById(studentId);
		
		res.json({
			success: true,
			data: {
				student: {
					id: student._id,
					hoTen: student.hoTen,
					ngaySinh: student.ngaySinh,
					gioiTinh: student.gioiTinh,
					phongHoc: student.phongHoc
				},
				progress: progress.map(p => ({
					id: p._id,
					baiHoc: p.baiHoc,
					troChoi: p.troChoi,
					diemSo: p.diemSo,
					thoiGianDaDung: p.thoiGianDaDung,
					ngayHoanThanh: p.ngayHoanThanh,
					cauTraLoi: p.cauTraLoi,
					loai: p.loai
				})),
				totalCompleted: progress.length,
				averageScore: progress.length > 0
					? Math.round(progress.reduce((sum, p) => sum + p.diemSo, 0) / progress.length)
					: 0
			}
		});
	} catch (e) {
		next(e);
	}
};

const createLessonInClass = async (req, res, next) => {
	try {
		const classId = req.params.id;
		const classData = await Class.findById(classId);
		if (!classData) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy lớp' });
		}

		const userId = req.user.id || req.user._id;
		if (req.user.vaiTro === 'giaoVien' && classData.giaoVien.toString() !== userId.toString()) {
			return res.status(403).json({ success: false, message: 'Bạn không có quyền tạo bài học trong lớp này' });
		}

		const lessonController = require('./lessonController');
		req.body.lop = [classId];
		return lessonController.createLesson(req, res, next);
	} catch (e) {
		next(e);
	}
};

const updateLessonInClass = async (req, res, next) => {
	try {
		const Joi = require('joi');
		const classId = req.params.id;
		const lessonId = req.params.lessonId;
		
		const classData = await Class.findById(classId);
		if (!classData) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy lớp' });
		}

		const userId = req.user.id || req.user._id;
		if (req.user.vaiTro === 'giaoVien' && classData.giaoVien.toString() !== userId.toString()) {
			return res.status(403).json({ success: false, message: 'Bạn không có quyền cập nhật bài học trong lớp này' });
		}

		// Kiểm tra bài học có thuộc lớp này không
		if (!classData.baiTap.includes(lessonId)) {
			return res.status(403).json({ success: false, message: 'Bài học không thuộc lớp này' });
		}

		// Validate dữ liệu
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
		
		// Xử lý đáp án đúng cho trắc nghiệm
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
		
		const lesson = await Lesson.findByIdAndUpdate(lessonId, value, { new: true });
		if (!lesson) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy bài học' });
		}
		
		res.json({ success: true, data: lesson });
	} catch (e) {
		next(e);
	}
};

const createGameInClass = async (req, res, next) => {
	try {
		const classId = req.params.id;
		const classData = await Class.findById(classId);
		if (!classData) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy lớp' });
		}

		const userId = req.user.id || req.user._id;
		if (req.user.vaiTro === 'giaoVien' && classData.giaoVien.toString() !== userId.toString()) {
			return res.status(403).json({ success: false, message: 'Bạn không có quyền tạo trò chơi trong lớp này' });
		}

		const gameController = require('./gameController');
		req.body.lop = [classId];
		return gameController.createGame(req, res, next);
	} catch (e) {
		next(e);
	}
};

const getClassLessonsWithStats = async (req, res, next) => {
	try {
		const classId = req.params.id;
		
		const classData = await Class.findById(classId)
			.populate('hocSinh', 'hoTen ngaySinh gioiTinh anhDaiDien')
			.populate('baiTap', 'tieuDe danhMuc capDo moTa anhDaiDien')
			.populate('troChoi', 'tieuDe danhMuc loai moTa anhDaiDien');
		
		if (!classData) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy lớp' });
		}
		
		const userId = req.user.id || req.user._id;
		if (req.user.vaiTro === 'giaoVien' && classData.giaoVien.toString() !== userId.toString()) {
			return res.status(403).json({ success: false, message: 'Bạn không có quyền xem kết quả lớp này' });
		}
		
		const studentIds = classData.hocSinh.map(s => s._id);
		const totalStudents = studentIds.length;
		
		const lessonsWithStats = await Promise.all(
			(classData.baiTap || []).map(async (lesson) => {
				const submittedProgress = await Progress.find({
					baiHoc: lesson._id,
					treEm: { $in: studentIds },
					trangThai: 'hoanThanh',
					loai: 'baiHoc'
				});
				
				const submittedCount = submittedProgress.length;
				const notSubmittedCount = totalStudents - submittedCount;
				const averageScore = submittedCount > 0
					? Math.round(submittedProgress.reduce((sum, p) => sum + (p.diemSo || 0), 0) / submittedCount)
					: 0;
				
				return {
					id: lesson._id,
					title: lesson.tieuDe,
					description: lesson.moTa,
					category: lesson.danhMuc,
					level: lesson.capDo,
					image: lesson.anhDaiDien,
					summary: {
						totalStudents: totalStudents,
						submittedCount: submittedCount,
						notSubmittedCount: notSubmittedCount,
						averageScore: averageScore
					}
				};
			})
		);

		const gamesWithStats = await Promise.all(
			(classData.troChoi || []).map(async (game) => {
				const submittedProgress = await Progress.find({
					troChoi: game._id,
					treEm: { $in: studentIds },
					trangThai: 'hoanThanh',
					loai: 'troChoi'
				});

				const submittedCount = submittedProgress.length;
				const notSubmittedCount = totalStudents - submittedCount;
				const averageScore = submittedCount > 0
					? Math.round(submittedProgress.reduce((sum, p) => sum + (p.diemSo || 0), 0) / submittedCount)
					: 0;

				return {
					id: game._id,
					title: game.tieuDe,
					description: game.moTa,
					category: game.danhMuc,
					type: game.loai,
					image: game.anhDaiDien,
					summary: {
						totalStudents: totalStudents,
						submittedCount: submittedCount,
						notSubmittedCount: notSubmittedCount,
						averageScore: averageScore
					}
				};
			})
		);
		
		res.json({
			success: true,
			data: {
				class: {
					id: classData._id,
					tenLop: classData.tenLop,
					moTa: classData.moTa
				},
				lessons: lessonsWithStats,
				games: gamesWithStats
			}
		});
	} catch (e) {
		next(e);
	}
};

module.exports = {
	listClasses,
	getClassById,
	createClass,
	updateClass,
	deleteClass,
	addTeacher,
	addStudent,
	removeStudent,
	getClassProgress,
	getStudentProgress,
	createLessonInClass,
	updateLessonInClass,
	createGameInClass,
	getClassLessonsWithStats
};

