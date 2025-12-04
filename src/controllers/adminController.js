const User = require('../models/NguoiDung');
const Child = require('../models/TreEm');
const Lesson = require('../models/BaiHoc');
const Game = require('../models/TroChoi');
const Progress = require('../models/TienDo');
const Report = require('../models/BaoCao');

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
		const { page = 1, limit = 20, role, isActive, isTrialAccount, isActivated } = req.query;
		const filter = {};
		if (role) filter.role = role;
		if (isActive !== undefined) filter.isActive = isActive === 'true';
		if (isTrialAccount !== undefined) filter.isTrialAccount = isTrialAccount === 'true';
		if (isActivated !== undefined) filter.isActivated = isActivated === 'true';

		const users = await User.find(filter)
			.select('-password')
			.sort({ createdAt: -1 })
			.limit(parseInt(limit))
			.skip((parseInt(page) - 1) * parseInt(limit));

		const usersWithTrialStatus = users.map(user => {
			const userObj = user.toObject();
			userObj.trialStatus = user.getTrialStatus();
			userObj.id = userObj._id;
			return userObj;
		});

		const total = await User.countDocuments(filter);

		res.json({
			success: true,
			data: usersWithTrialStatus,
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

const getTrialAccounts = async (req, res, next) => {
	try {
		const { page = 1, limit = 20, status } = req.query;
		const filter = { isTrialAccount: true, role: { $ne: 'admin' } };
		
		if (status === 'expired') {
			filter.trialEndDate = { $lt: new Date() };
			filter.isActivated = false;
		} else if (status === 'active') {
			filter.trialEndDate = { $gte: new Date() };
			filter.isActivated = false;
		} else if (status === 'activated') {
			filter.isActivated = true;
		}

		const users = await User.find(filter)
			.select('-password')
			.sort({ createdAt: -1 })
			.limit(parseInt(limit))
			.skip((parseInt(page) - 1) * parseInt(limit));

		const usersWithTrialStatus = users.map(user => {
			const userObj = user.toObject();
			userObj.trialStatus = user.getTrialStatus();
			userObj.id = userObj._id;
			return userObj;
		});

		const total = await User.countDocuments(filter);

		res.json({
			success: true,
			data: usersWithTrialStatus,
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

const activateTrialAccount = async (req, res, next) => {
	try {
		const { userId } = req.params;
		
		const user = await User.findById(userId);
		if (!user) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
		}

		if (!user.isTrialAccount) {
			return res.status(400).json({ success: false, message: 'Đây không phải tài khoản dùng thử' });
		}

		if (user.isActivated) {
			return res.status(400).json({ success: false, message: 'Tài khoản đã được kích hoạt' });
		}

		user.isActivated = true;
		await user.save();

		const trialStatus = user.getTrialStatus();

		res.json({
			success: true,
			message: 'Kích hoạt tài khoản thành công',
			data: {
				user: {
					id: user._id,
					name: user.name,
					email: user.email,
					role: user.role,
					trialStatus: trialStatus
				}
			}
		});
	} catch (e) {
		next(e);
	}
};

const deactivateTrialAccount = async (req, res, next) => {
	try {
		const { userId } = req.params;
		
		const user = await User.findById(userId);
		if (!user) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
		}

		if (!user.isTrialAccount) {
			return res.status(400).json({ success: false, message: 'Đây không phải tài khoản dùng thử' });
		}

		user.isActivated = false;
		await user.save();

		const trialStatus = user.getTrialStatus();

		res.json({
			success: true,
			message: 'Hủy kích hoạt tài khoản thành công',
			data: {
				user: {
					id: user._id,
					name: user.name,
					email: user.email,
					role: user.role,
					trialStatus: trialStatus
				}
			}
		});
	} catch (e) {
		next(e);
	}
};

const extendTrialPeriod = async (req, res, next) => {
	try {
		const { userId } = req.params;
		const { days = 7 } = req.body;
		
		const user = await User.findById(userId);
		if (!user) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
		}

		if (!user.isTrialAccount) {
			return res.status(400).json({ success: false, message: 'Đây không phải tài khoản dùng thử' });
		}

		const currentEndDate = user.trialEndDate || new Date();
		user.trialEndDate = new Date(currentEndDate.getTime() + days * 24 * 60 * 60 * 1000);
		await user.save();

		const trialStatus = user.getTrialStatus();

		res.json({
			success: true,
			message: `Gia hạn tài khoản dùng thử thành công thêm ${days} ngày`,
			data: {
				user: {
					id: user._id,
					name: user.name,
					email: user.email,
					role: user.role,
					trialStatus: trialStatus
				}
			}
		});
	} catch (e) {
		next(e);
	}
};

const getTrialStats = async (req, res, next) => {
	try {
		const trialFilter = { isTrialAccount: true, role: { $ne: 'admin' } };
		const totalTrialAccounts = await User.countDocuments(trialFilter);
		const activatedTrialAccounts = await User.countDocuments({ ...trialFilter, isActivated: true });
		const expiredTrialAccounts = await User.countDocuments({ 
			...trialFilter,
			isActivated: false,
			trialEndDate: { $lt: new Date() }
		});
		const activeTrialAccounts = await User.countDocuments({ 
			...trialFilter,
			isActivated: false,
			trialEndDate: { $gte: new Date() }
		});

		res.json({
			success: true,
			data: {
				totalTrialAccounts,
				activatedTrialAccounts,
				expiredTrialAccounts,
				activeTrialAccounts
			}
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
	getTrialAccounts,
	activateTrialAccount,
	deactivateTrialAccount,
	extendTrialPeriod,
	getTrialStats
};