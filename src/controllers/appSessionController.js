const AppSession = require('../models/PhienLamViec');
const Child = require('../models/TreEm');

const startSession = async (req, res, next) => {
	try {
		const { childId } = req.body;
		
		let child;
		if (req.user.vaiTro === 'hocSinh') {
			// Học sinh: tìm Child với _id = req.user.id (vì Child._id = User học sinh._id)
			// Không cần childId từ body
			child = await Child.findById(req.user.id || req.user._id);
			if (!child) {
				return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ học sinh' });
			}
		} else {
			if (!childId) {
				return res.status(400).json({ success: false, message: 'Child ID is required' });
			}
			child = await Child.findOne({ _id: childId, phuHuynh: req.user.id });
			if (!child) {
				return res.status(404).json({ success: false, message: 'Child not found' });
			}
		}
		
		const actualChildId = child._id.toString();

		const activeSession = await AppSession.findOne({ 
			treEm: actualChildId, 
			trangThai: 'dangHoatDong' 
		});

		if (activeSession) {
			activeSession.thoiGianBatDau = new Date();
			await activeSession.save();
			
			return res.json({ 
				success: true, 
				data: {
					_id: activeSession._id,
					child: activeSession.treEm,
					startTime: activeSession.thoiGianBatDau,
					endTime: activeSession.thoiGianKetThuc,
					duration: activeSession.thoiGian,
					status: activeSession.trangThai === 'dangHoatDong' ? 'active' : 'completed'
				},
				message: 'Session updated with new start time'
			});
		}

		const session = new AppSession({
			treEm: actualChildId,
			thoiGianBatDau: new Date(),
			trangThai: 'dangHoatDong'
		});

		await session.save();

		res.json({
			success: true,
			data: {
				_id: session._id,
				child: session.treEm,
				startTime: session.thoiGianBatDau,
				endTime: session.thoiGianKetThuc,
				duration: session.thoiGian,
				status: 'active'
			},
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
		if (req.user.vaiTro === 'hocSinh') {
			// Học sinh: tìm Child với _id = req.user.id (vì Child._id = User học sinh._id)
			// Không cần childId từ body
			child = await Child.findById(req.user.id || req.user._id);
			if (!child) {
				return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ học sinh' });
			}
		} else {
			// Phụ huynh: cần childId từ body
			if (!childId) {
				return res.status(400).json({ success: false, message: 'Child ID is required' });
			}
			child = await Child.findOne({ _id: childId, phuHuynh: req.user.id });
			if (!child) {
				return res.status(404).json({ success: false, message: 'Child not found' });
			}
		}
		
		const actualChildId = child._id.toString();

		const session = await AppSession.findOne({ 
			treEm: actualChildId, 
			trangThai: 'dangHoatDong' 
		});

		if (!session) {
			return res.status(404).json({ success: false, message: 'No active session found' });
		}

		session.thoiGianKetThuc = new Date();
		session.thoiGian = Math.floor((session.thoiGianKetThuc - session.thoiGianBatDau) / 1000);
		session.trangThai = 'hoanThanh';

		await session.save();

		res.json({
			success: true,
			data: {
				_id: session._id,
				child: session.treEm,
				startTime: session.thoiGianBatDau,
				endTime: session.thoiGianKetThuc,
				duration: session.thoiGian,
				status: 'completed'
			},
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
		
		let child;
		if (req.user.vaiTro === 'hocSinh') {
			// Học sinh: tìm Child với _id = req.user.id
			child = await Child.findById(req.user.id || req.user._id);
		} else {
			// Phụ huynh: tìm Child với _id = childId và phuHuynh = req.user.id
			child = await Child.findOne({ _id: childId, phuHuynh: req.user.id });
		}
		
		if (!child) {
			return res.status(404).json({ success: false, message: 'Child not found' });
		}

		const actualChildId = child._id.toString();
		const sessions = await AppSession.find({ treEm: actualChildId })
			.sort({ thoiGianBatDau: -1 })
			.limit(parseInt(limit))
			.skip((parseInt(page) - 1) * parseInt(limit));

		const total = await AppSession.countDocuments({ treEm: actualChildId });

		// Map sessions để trả về format đúng với frontend
		const mappedSessions = sessions.map(session => ({
			_id: session._id,
			id: session._id,
			child: session.treEm,
			startTime: session.thoiGianBatDau,
			endTime: session.thoiGianKetThuc,
			duration: session.thoiGian,
			status: session.trangThai === 'dangHoatDong' ? 'active' : 'completed'
		}));

		res.json({
			success: true,
			data: {
				sessions: mappedSessions,
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
		
		let child;
		if (req.user.vaiTro === 'hocSinh') {
			// Học sinh: tìm Child với _id = req.user.id
			child = await Child.findById(req.user.id || req.user._id);
		} else {
			// Phụ huynh: tìm Child với _id = childId và phuHuynh = req.user.id
			child = await Child.findOne({ _id: childId, phuHuynh: req.user.id });
		}
		
		if (!child) {
			return res.status(404).json({ success: false, message: 'Child not found' });
		}

		const actualChildId = child._id.toString();
		const filter = { 
			treEm: actualChildId,
			trangThai: 'hoanThanh'
		};

		if (startDate && endDate) {
			filter.thoiGianBatDau = {
				$gte: new Date(startDate),
				$lte: new Date(endDate)
			};
		}

		const result = await AppSession.aggregate([
			{ $match: filter },
			{
				$group: {
					_id: null,
					totalDuration: { $sum: '$thoiGian' },
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
		
		let child;
		if (req.user.vaiTro === 'hocSinh') {
			// Học sinh: tìm Child với _id = req.user.id
			child = await Child.findById(req.user.id || req.user._id);
		} else if (req.user.vaiTro === 'admin') {
			// Admin: tìm Child với _id = childId
			child = await Child.findById(childId);
		} else {
			// Phụ huynh: tìm Child với _id = childId và phuHuynh = req.user.id
			child = await Child.findOne({ _id: childId, phuHuynh: req.user.id });
		}
		
		if (!child) {
			return res.status(404).json({ success: false, message: 'Child not found' });
		}

		const actualChildId = child._id.toString();
		const activeSession = await AppSession.findOne({ 
			treEm: actualChildId,
			trangThai: 'dangHoatDong'
		})
		.sort({ thoiGianBatDau: -1 });

		if (activeSession) {
			const now = new Date();
			const diffInSeconds = Math.floor((now - activeSession.thoiGianBatDau) / 1000);
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
					lastActivityTime: activeSession.thoiGianBatDau,
					timeAgo,
					duration: diffInSeconds,
					isActive: true,
					statusText
				}
			});
		}

		const lastSession = await AppSession.findOne({ 
			treEm: actualChildId,
			trangThai: 'hoanThanh'
		})
		.sort({ thoiGianKetThuc: -1 });

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
		const diffInSeconds = Math.floor((now - lastSession.thoiGianKetThuc) / 1000);
		
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
				lastActivityTime: lastSession.thoiGianKetThuc,
				timeAgo,
				duration: lastSession.thoiGian,
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

