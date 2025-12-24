const Joi = require('joi');
const { ThongBao } = require('../models/ThongBao');
const User = require('../models/NguoiDung');
const Child = require('../models/TreEm');

const getNotifications = async (req, res, next) => {
	try {
		const { page = 1, limit = 20, type, isRead } = req.query;
		
		// Xử lý filter dựa trên vai trò người dùng
		let filter = {};
		if (req.user.vaiTro === 'phuHuynh') {
			// Phụ huynh: lấy thông báo của mình hoặc của trẻ mình quản lý
			const children = await Child.find({ phuHuynh: req.user.id }).select('_id');
			const childIds = children.map(c => c._id);
			filter = {
				$or: [
					{ nguoiDung: req.user.id },
					{ treEm: { $in: childIds } }
				]
			};
		} else if (req.user.vaiTro === 'hocSinh') {
			// Học sinh: lấy thông báo của trẻ (vì Child._id = User._id)
			const child = await Child.findById(req.user.id);
			if (child) {
				filter = {
					$or: [
						{ nguoiDung: req.user.id },
						{ treEm: child._id }
					]
				};
			} else {
				filter = { nguoiDung: req.user.id };
			}
		} else {
			filter = { nguoiDung: req.user.id };
		}
		
		if (type) filter.loai = type;
		if (isRead !== undefined) filter.daDoc = isRead === 'true';
		
		const notifications = await ThongBao.find(filter)
			.populate('nguoiDung', 'hoTen email')
			.populate('treEm', 'hoTen anhDaiDien')
			.populate('duLieu.idBaiHoc', 'tieuDe danhMuc')
			.populate('duLieu.idTroChoi', 'tieuDe loai')
			.sort({ createdAt: -1 })
			.limit(parseInt(limit))
			.skip((parseInt(page) - 1) * parseInt(limit));
		
		const total = await ThongBao.countDocuments(filter);
		
		// Map dữ liệu để trả về format đúng với frontend
		const mappedNotifications = notifications.map(notif => ({
			_id: notif._id,
			id: notif._id,
			user: notif.nguoiDung?._id || notif.nguoiDung,
			child: notif.treEm?._id || notif.treEm,
			type: notif.loai,
			title: notif.tieuDe,
			content: notif.noiDung,
			data: {
				lessonId: notif.duLieu?.idBaiHoc?._id || notif.duLieu?.idBaiHoc,
				gameId: notif.duLieu?.idTroChoi?._id || notif.duLieu?.idTroChoi,
				score: notif.duLieu?.diemSo,
				achievement: notif.duLieu?.thanhTich
			},
			isRead: notif.daDoc || false,
			readAt: notif.ngayDoc,
			createdAt: notif.createdAt || notif.ngayGui,
			updatedAt: notif.updatedAt
		}));
		
		res.json({ 
			success: true, 
			data: { 
				notifications: mappedNotifications, 
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

const markAsRead = async (req, res, next) => {
	try {
		let filter = { _id: req.params.id };
		if (req.user.vaiTro === 'phuHuynh') {
			const children = await Child.find({ phuHuynh: req.user.id }).select('_id');
			const childIds = children.map(c => c._id);
			filter.$or = [
				{ nguoiDung: req.user.id },
				{ treEm: { $in: childIds } }
			];
		} else {
			filter.nguoiDung = req.user.id;
		}
		
		const notification = await ThongBao.findOneAndUpdate(
			filter,
			{ daDoc: true, ngayDoc: new Date() },
			{ new: true }
		);
		
		if (!notification) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo' });
		}
		
		res.json({ success: true, data: notification });
	} catch (e) {
		next(e);
	}
};

const markAllAsRead = async (req, res, next) => {
	try {
		// Xử lý filter dựa trên vai trò người dùng
		let filter = { daDoc: false };
		if (req.user.vaiTro === 'phuHuynh') {
			const children = await Child.find({ phuHuynh: req.user.id }).select('_id');
			const childIds = children.map(c => c._id);
			filter.$or = [
				{ nguoiDung: req.user.id },
				{ treEm: { $in: childIds } }
			];
		} else {
			filter.nguoiDung = req.user.id;
		}
		
		await ThongBao.updateMany(
			filter,
			{ daDoc: true, ngayDoc: new Date() }
		);
		
		res.json({ success: true, message: 'Đã đánh dấu tất cả thông báo là đã đọc' });
	} catch (e) {
		next(e);
	}
};

const createNotification = async (req, res, next) => {
	try {
		const schema = Joi.object({
			user: Joi.string().required(),
			child: Joi.string().optional(),
			type: Joi.string().valid('nhacNho', 'tomTat', 'thanhTich', 'heThong', 'lichHoc').required(),
			title: Joi.string().required(),
			content: Joi.string().required(),
			data: Joi.object({
				lessonId: Joi.string().optional(),
				gameId: Joi.string().optional(),
				score: Joi.number().optional(),
				achievement: Joi.string().optional()
			}).optional()
		});
		
		const notificationData = await schema.validateAsync(req.body);
		
		// Map từ format frontend sang format model
		const notification = await ThongBao.create({
			nguoiDung: notificationData.user,
			treEm: notificationData.child,
			loai: notificationData.type,
			tieuDe: notificationData.title,
			noiDung: notificationData.content,
			duLieu: notificationData.data ? {
				idBaiHoc: notificationData.data.lessonId,
				idTroChoi: notificationData.data.gameId,
				diemSo: notificationData.data.score,
				thanhTich: notificationData.data.achievement
			} : undefined,
			daDoc: false,
			ngayGui: new Date()
		});
		
		res.status(201).json({ success: true, data: notification });
	} catch (e) {
		next(e);
	}
};

const deleteNotification = async (req, res, next) => {
	try {
		// Tìm thông báo với điều kiện phù hợp với vai trò
		let filter = { _id: req.params.id };
		if (req.user.vaiTro === 'phuHuynh') {
			const children = await Child.find({ phuHuynh: req.user.id }).select('_id');
			const childIds = children.map(c => c._id);
			filter.$or = [
				{ nguoiDung: req.user.id },
				{ treEm: { $in: childIds } }
			];
		} else {
			filter.nguoiDung = req.user.id;
		}
		
		const notification = await ThongBao.findOneAndDelete(filter);
		
		if (!notification) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo' });
		}
		
		res.json({ success: true, message: 'Xóa thông báo thành công' });
	} catch (e) {
		next(e);
	}
};

const getUnreadCount = async (req, res, next) => {
	try {
		// Xử lý filter dựa trên vai trò người dùng
		let filter = { daDoc: false };
		if (req.user.vaiTro === 'phuHuynh') {
			const children = await Child.find({ phuHuynh: req.user.id }).select('_id');
			const childIds = children.map(c => c._id);
			filter.$or = [
				{ nguoiDung: req.user.id },
				{ treEm: { $in: childIds } }
			];
		} else if (req.user.vaiTro === 'hocSinh') {
			const child = await Child.findById(req.user.id);
			if (child) {
				filter.$or = [
					{ nguoiDung: req.user.id },
					{ treEm: child._id }
				];
			} else {
				filter.nguoiDung = req.user.id;
			}
		} else {
			filter.nguoiDung = req.user.id;
		}
		
		const count = await ThongBao.countDocuments(filter);
		
		res.json({ success: true, data: { count } });
	} catch (e) {
		next(e);
	}
};

const sendNotificationToAll = async (req, res, next) => {
	try {
		
		const schema = Joi.object({
			type: Joi.string().valid('reminder', 'summary', 'achievement', 'system', 'schedule').required(),
			title: Joi.string().required(),
			content: Joi.string().required(),
			targetRole: Joi.string().valid('all', 'parent', 'child').optional(),
			scheduledAt: Joi.date().optional()
		});
		
		const { type, title, content, targetRole = 'all', scheduledAt } = await schema.validateAsync(req.body);
		
		let users;
		if (targetRole === 'all') {
			users = await User.find({ trangThai: true });
		} else if (targetRole === 'parent') {
			users = await User.find({ vaiTro: 'phuHuynh', trangThai: true });
		} else if (targetRole === 'child') {
			users = await User.find({ vaiTro: 'hocSinh', trangThai: true });
		} else {
			users = await User.find({ vaiTro: targetRole, trangThai: true });
		}
		
		// Map type từ frontend sang model
		const loaiMap = {
			'reminder': 'nhacNho',
			'summary': 'tomTat',
			'achievement': 'thanhTich',
			'system': 'heThong',
			'schedule': 'lichHoc'
		};
		
		const notifications = users.map(user => ({
			nguoiDung: user._id,
			loai: loaiMap[type] || type,
			tieuDe: title,
			noiDung: content,
			daDoc: false,
			ngayGui: scheduledAt || new Date()
		}));
		
		await ThongBao.insertMany(notifications);
		
		const NotificationHistory = require('../models/LichSuThongBao');
		await NotificationHistory.create({
			sentBy: req.user.id,
			type,
			title,
			content,
			targetRole,
			recipientCount: users.length,
			scheduledAt: scheduledAt || new Date(),
			status: 'sent'
		});
		
		res.json({ 
			success: true, 
			message: `Đã gửi thông báo đến ${users.length} người dùng`,
			data: { count: users.length }
		});
	} catch (e) {
		next(e);
	}
};

const getNotificationHistory = async (req, res, next) => {
	try {
		const { page = 1, limit = 20, type, status } = req.query;
		const filter = { sentBy: req.user.id };
		if (type) filter.type = type;
		if (status) filter.status = status;

		const NotificationHistory = require('../models/LichSuThongBao');
		const history = await NotificationHistory.find(filter)
			.sort({ createdAt: -1 })
			.limit(parseInt(limit))
			.skip((parseInt(page) - 1) * parseInt(limit));

		const total = await NotificationHistory.countDocuments(filter);

		res.json({
			success: true,
			data: {
				history,
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

const sendNotificationToChild = async (req, res, next) => {
	try {
		const schema = Joi.object({
			childId: Joi.string().required(),
			type: Joi.string().valid('reminder', 'summary', 'achievement', 'system', 'schedule').required(),
			title: Joi.string().required(),
			content: Joi.string().required(),
			data: Joi.object({
				lessonId: Joi.string().optional(),
				gameId: Joi.string().optional(),
				score: Joi.number().optional(),
				achievement: Joi.string().optional()
			}).optional()
		});
		
		const notificationData = await schema.validateAsync(req.body);
		
		const child = await Child.findById(notificationData.childId);
		if (!child) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy trẻ' });
		}
		
		// Map type từ frontend sang model
		const loaiMap = {
			'reminder': 'nhacNho',
			'summary': 'tomTat',
			'achievement': 'thanhTich',
			'system': 'heThong',
			'schedule': 'lichHoc'
		};
		
		const notification = await ThongBao.create({
			nguoiDung: child.phuHuynh,
			treEm: child._id,
			loai: loaiMap[notificationData.type] || notificationData.type,
			tieuDe: notificationData.title,
			noiDung: notificationData.content,
			duLieu: notificationData.data ? {
				idBaiHoc: notificationData.data.lessonId,
				idTroChoi: notificationData.data.gameId,
				diemSo: notificationData.data.score,
				thanhTich: notificationData.data.achievement
			} : undefined,
			daDoc: false,
			ngayGui: new Date()
		});
		
		res.status(201).json({ success: true, data: notification });
	} catch (e) {
		next(e);
	}
};

module.exports = {
	getNotifications,
	markAsRead,
	markAllAsRead,
	createNotification,
	deleteNotification,
	getUnreadCount,
	sendNotificationToAll,
	sendNotificationToChild,
	getNotificationHistory
};