const AppSession = require('../models/PhienLamViec');
const Child = require('../models/TreEm');

const startSession = async (req, res, next) => {
	try {
		const { childId } = req.body;
		
		let child;
		if (req.user.vaiTro === 'hocSinh' && req.user.id === childId) {
			child = await Child.findOne({ _id: childId });
		} else {
			child = await Child.findOne({ _id: childId, phuHuynh: req.user.id });
		}
		
		if (!child) {
			return res.status(404).json({ success: false, message: 'Child not found' });
		}

	const activeSession = await AppSession.findOne({ 
		child: childId, 
		status: 'active' 
	});

	if (activeSession) {
		activeSession.startTime = new Date();
		await activeSession.save();
		
		return res.json({ 
			success: true, 
			data: activeSession,
			message: 'Session updated with new start time'
		});
	}

	const session = new AppSession({
		child: childId,
		startTime: new Date(),
		status: 'active'
	});

	await session.save();

		res.json({
			success: true,
			data: session,
			message: 'Session started'
		});
	} catch (e) {
		next(e);
	}
};

const endSession = async (req, res, next) => {
	try {
		const { childId } = req.body;
		
		let child;
		if (req.user.vaiTro === 'hocSinh' && req.user.id === childId) {
			child = await Child.findOne({ _id: childId });
		} else {
			child = await Child.findOne({ _id: childId, phuHuynh: req.user.id });
		}
		
		if (!child) {
			return res.status(404).json({ success: false, message: 'Child not found' });
		}

		const session = await AppSession.findOne({ 
			child: childId, 
			status: 'active' 
		});

		if (!session) {
			return res.status(404).json({ success: false, message: 'No active session found' });
		}

		session.endTime = new Date();
		session.duration = Math.floor((session.endTime - session.startTime) / 1000);
		session.status = 'completed';

		await session.save();

		res.json({
			success: true,
			data: session,
			message: 'Session ended'
		});
	} catch (e) {
		next(e);
	}
};
// 2 cai trrn la luu vao dattabase ccollet session
const getChildSessions = async (req, res, next) => {
	try {
		const { childId } = req.params;
		const { page = 1, limit = 50 } = req.query;
		
		const child = await Child.findOne({ _id: childId, phuHuynh: req.user.id });
		if (!child) {
			return res.status(404).json({ success: false, message: 'Child not found' });
		}

		const sessions = await AppSession.find({ child: childId })
			.sort({ startTime: -1 })
			.limit(parseInt(limit))
			.skip((parseInt(page) - 1) * parseInt(limit));

		const total = await AppSession.countDocuments({ child: childId });

		res.json({
			success: true,
			data: {
				sessions,
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
// nói chung là các hàm tương ưng trong router này, gồm lưu thời gian đăng hập đăng xuất,lấy ra ở phụ huynh -phần logic
const getTotalUsageTime = async (req, res, next) => {
	try {
		const { childId } = req.params;
		const { startDate, endDate } = req.query;
		
		const child = await Child.findOne({ _id: childId, phuHuynh: req.user.id });
		if (!child) {
			return res.status(404).json({ success: false, message: 'Child not found' });
		}

		const filter = { 
			child: childId,
			status: 'completed'
		};

		if (startDate && endDate) {
			filter.startTime = {
				$gte: new Date(startDate),
				$lte: new Date(endDate)
			};
		}

		const result = await AppSession.aggregate([
			{ $match: filter },
			{
				$group: {
					_id: null,
					totalDuration: { $sum: '$duration' },
					sessionCount: { $sum: 1 }
				}
			}
		]);

		const stats = result[0] || { totalDuration: 0, sessionCount: 0 };

		res.json({
			success: true,
			data: {
				totalDuration: stats.totalDuration,
				sessionCount: stats.sessionCount,
				totalMinutes: Math.floor(stats.totalDuration / 60),
				totalHours: Math.floor(stats.totalDuration / 3600)
			}
		});
	} catch (e) {
		next(e);
	}
};

const getLastActivityTime = async (req, res, next) => {
	try {
		const { childId } = req.params;
		
		const childQuery = req.user.vaiTro === 'admin' 
			? { _id: childId }
			: { _id: childId, phuHuynh: req.user.id };
		
		const child = await Child.findOne(childQuery);
		if (!child) {
			return res.status(404).json({ success: false, message: 'Child not found' });
		}

		const activeSession = await AppSession.findOne({ 
			child: childId,
			status: 'active'
		})
		.sort({ startTime: -1 });

		if (activeSession) {
			const now = new Date();
			const diffInSeconds = Math.floor((now - activeSession.startTime) / 1000);
			const durationInMinutes = Math.floor(diffInSeconds / 60);
			const durationInHours = Math.floor(diffInSeconds / 3600);
			
			let timeAgo;
			let statusText;
			
			if (diffInSeconds < 60) {
				timeAgo = 'Đang hoạt động';
				statusText = 'Đang hoạt động';
			} else if (diffInSeconds < 3600) {
				timeAgo = `Đã hoạt động ${durationInMinutes} phút`;
				statusText = 'Đang hoạt động';
			} else if (diffInSeconds < 86400) {
				const remainingMinutes = Math.floor((diffInSeconds % 3600) / 60);
				if (remainingMinutes > 0) {
					timeAgo = `Đã hoạt động ${durationInHours} giờ ${remainingMinutes} phút`;
				} else {
					timeAgo = `Đã hoạt động ${durationInHours} giờ`;
				}
				statusText = 'Đang hoạt động';
			} else {
				const days = Math.floor(diffInSeconds / 86400);
				const remainingHours = Math.floor((diffInSeconds % 86400) / 3600);
				if (remainingHours > 0) {
					timeAgo = `Đã hoạt động ${days} ngày ${remainingHours} giờ`;
				} else {
					timeAgo = `Đã hoạt động ${days} ngày`;
				}
				statusText = 'Đang hoạt động';
			}

			return res.json({
				success: true,
				data: {
					lastActivityTime: activeSession.startTime,
					timeAgo,
					duration: diffInSeconds,
					isActive: true,
					statusText
				}
			});
		}

		const lastSession = await AppSession.findOne({ 
			child: childId,
			status: 'completed'
		})
		.sort({ endTime: -1 });

		if (!lastSession) {
			return res.json({
				success: true,
				data: {
					lastActivityTime: null,
					timeAgo: 'Chưa có hoạt động',
					isActive: false,
					statusText: 'Chưa có hoạt động',
					duration: 0
				}
			});
		}

		const now = new Date();
		const diffInSeconds = Math.floor((now - lastSession.endTime) / 1000);
		
		let timeAgo;
		if (diffInSeconds < 60) {
			timeAgo = 'Vừa xong';
		} else if (diffInSeconds < 3600) {
			timeAgo = `${Math.floor(diffInSeconds / 60)} phút trước`;
		} else if (diffInSeconds < 86400) {
			timeAgo = `${Math.floor(diffInSeconds / 3600)} giờ trước`;
		} else if (diffInSeconds < 2592000) {
			timeAgo = `${Math.floor(diffInSeconds / 86400)} ngày trước`;
		} else {
			timeAgo = `${Math.floor(diffInSeconds / 2592000)} tháng trước`;
		}

		res.json({
			success: true,
			data: {
				lastActivityTime: lastSession.endTime,
				timeAgo,
				duration: lastSession.duration,
				isActive: false,
				statusText: 'Đã kết thúc'
			}
		});
	} catch (e) {
		next(e);
	}
};

module.exports = {
	startSession,
	endSession,
	getChildSessions,
	getTotalUsageTime,
	getLastActivityTime
};

