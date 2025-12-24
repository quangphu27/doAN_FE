const User = require('../models/NguoiDung');
const Child = require('../models/TreEm');
const Lesson = require('../models/BaiHoc');
const Game = require('../models/TroChoi');
const Progress = require('../models/TienDo');
const Report = require('../models/BaoCao');
const AppSession = require('../models/PhienLamViec');

const getStats = async (req, res, next) => {
	try {
		const totalUsers = await User.countDocuments();
		const totalChildren = await Child.countDocuments();
		const totalLessons = await Lesson.countDocuments();
		const totalGames = await Game.countDocuments();
		const activeUsers = await User.countDocuments({ isActive: true });
		const completedLessons = await Progress.countDocuments({ status: 'completed' });

		res.json({
			success: true,
			data: {
				totalUsers,
				totalChildren,
				totalLessons,
				totalGames,
				activeUsers,
				completedLessons
			}
		});
	} catch (e) {
		next(e);
	}
};

const getUsers = async (req, res, next) => {
	try {
		const { page = 1, limit = 20, vaiTro } = req.query;
		const filter = {};
		if (vaiTro) filter.vaiTro = vaiTro;

		const users = await User.find(filter)
			.select('-matKhau')
			.sort({ createdAt: -1 })
			.limit(parseInt(limit))
			.skip((parseInt(page) - 1) * parseInt(limit));

		const usersList = users.map(user => {
			const userObj = user.toObject();
			userObj.id = userObj._id;
			return userObj;
		});

		const total = await User.countDocuments(filter);

		res.json({
			success: true,
			data: usersList,
			pagination: {
				total,
				page: parseInt(page),
				limit: parseInt(limit),
				pages: Math.ceil(total / parseInt(limit))
			}
		});
	} catch (e) {
		next(e);
	}
};

const getChildren = async (req, res, next) => {
	try {
		const { page = 1, limit = 20, learningLevel, isActive } = req.query;
		const filter = {};
		if (learningLevel) filter.learningLevel = learningLevel;
		if (isActive !== undefined) filter.isActive = isActive === 'true';

		const children = await Child.find(filter)
			.populate('parent', 'name email')
			.sort({ createdAt: -1 })
			.limit(parseInt(limit))
			.skip((parseInt(page) - 1) * parseInt(limit));

		const total = await Child.countDocuments(filter);

		res.json({
			success: true,
			data: children,
			pagination: {
				total,
				page: parseInt(page),
				limit: parseInt(limit),
				pages: Math.ceil(total / parseInt(limit))
			}
		});
	} catch (e) {
		next(e);
	}
};

const getReports = async (req, res, next) => {
	try {
		const { page = 1, limit = 20, period, startDate, endDate } = req.query;
		const filter = {};
		if (period) filter.period = period;
		if (startDate && endDate) {
			filter.generatedDate = {
				$gte: new Date(startDate),
				$lte: new Date(endDate)
			};
		}

		const reports = await Report.find(filter)
			.populate('parent', 'name email')
			.populate('child', 'name avatarUrl')
			.sort({ generatedDate: -1 })
			.limit(parseInt(limit))
			.skip((parseInt(page) - 1) * parseInt(limit));

		const total = await Report.countDocuments(filter);

		res.json({
			success: true,
			data: reports,
			pagination: {
				total,
				page: parseInt(page),
				limit: parseInt(limit),
				pages: Math.ceil(total / parseInt(limit))
			}
		});
	} catch (e) {
		next(e);
	}
};

const getActiveChildren = async (req, res, next) => {
	try {
		const allSessions = await AppSession.find({})
			.sort({ thoiGianBatDau: -1 })
			.limit(500)
			.lean();

		const sessionMap = new Map();
		
		allSessions.forEach(session => {
			if (!session.treEm) return;
			
			const childId = session.treEm.toString();
			const existingSession = sessionMap.get(childId);
			
			let sessionTime;
			if (session.trangThai === 'dangHoatDong') {
				sessionTime = new Date(session.thoiGianBatDau);
			} else if (session.thoiGianKetThuc) {
				sessionTime = new Date(session.thoiGianKetThuc);
			} else {
				sessionTime = new Date(session.thoiGianBatDau);
			}
			
			if (!existingSession) {
				sessionMap.set(childId, { ...session, compareTime: sessionTime });
			} else {
				let existingTime;
				if (existingSession.trangThai === 'dangHoatDong') {
					existingTime = new Date(existingSession.thoiGianBatDau);
				} else if (existingSession.thoiGianKetThuc) {
					existingTime = new Date(existingSession.thoiGianKetThuc);
				} else {
					existingTime = new Date(existingSession.thoiGianBatDau);
				}
				
				if (sessionTime > existingTime) {
					sessionMap.set(childId, { ...session, compareTime: sessionTime });
				}
			}
		});

		const uniqueSessions = Array.from(sessionMap.values())
			.sort((a, b) => b.compareTime - a.compareTime)
			.slice(0, 5);

		const childIds = uniqueSessions.map(s => s.treEm);

		const children = await Child.find({ _id: { $in: childIds } })
			.populate('phuHuynh', 'hoTen email')
			.lean();

		const childrenMap = new Map(children.map(c => [c._id.toString(), c]));

		const childrenWithSessions = uniqueSessions.map(session => {
			const childId = session.treEm.toString();
			const child = childrenMap.get(childId);
			
			if (!child) return null;
			
			const now = new Date();
			const isActive = session.trangThai === 'dangHoatDong';
			const startTime = new Date(session.thoiGianBatDau);
			let lastActivityTime;
			let diffInSeconds = 0;
			
			if (isActive) {
				lastActivityTime = startTime;
				diffInSeconds = Math.floor((now - startTime) / 1000);
			} else if (session.thoiGianKetThuc) {
				lastActivityTime = new Date(session.thoiGianKetThuc);
				diffInSeconds = Math.floor((now - lastActivityTime) / 1000);
			} else {
				lastActivityTime = startTime;
				diffInSeconds = Math.floor((now - lastActivityTime) / 1000);
			}
			
			const diffInMinutes = Math.floor(diffInSeconds / 60);
			const diffInHours = Math.floor(diffInMinutes / 60);
			const remainingMinutes = diffInMinutes % 60;

			return {
				...child,
				id: child._id,
				startTime: startTime,
				lastActivityTime: lastActivityTime,
				duration: diffInSeconds,
				durationMinutes: diffInMinutes,
				durationHours: diffInHours,
				remainingMinutes: remainingMinutes,
				isActive: isActive
			};
		}).filter(Boolean);

		res.json({
			success: true,
			data: childrenWithSessions
		});
	} catch (e) {
		next(e);
	}
};

module.exports = {
	getStats,
	getUsers,
	getChildren,
	getReports,
	getActiveChildren
};