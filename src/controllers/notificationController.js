const Joi = require('joi');
const { Notification } = require('../models/ThongBao');
const User = require('../models/NguoiDung');
const Child = require('../models/TreEm');

const getNotifications = async (req, res, next) => {
	try {
		const { page = 1, limit = 20, type, isRead } = req.query;
		const filter = { user: req.user.id };
		if (type) filter.type = type;
		if (isRead !== undefined) filter.isRead = isRead === 'true';
		
		const notifications = await Notification.find(filter)
			.populate('child', 'name avatarUrl')
			.sort({ createdAt: -1 })
			.limit(parseInt(limit))
			.skip((parseInt(page) - 1) * parseInt(limit));
		
		const total = await Notification.countDocuments(filter);
		
		res.json({ 
			success: true, 
			data: { 
				notifications, 
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
		const notification = await Notification.findOneAndUpdate(
			{ _id: req.params.id, user: req.user.id },
			{ isRead: true, readAt: new Date() },
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
		await Notification.updateMany(
			{ user: req.user.id, isRead: false },
			{ isRead: true, readAt: new Date() }
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
		const notification = await Notification.create(notificationData);
		
		res.status(201).json({ success: true, data: notification });
	} catch (e) {
		next(e);
	}
};

const deleteNotification = async (req, res, next) => {
	try {
		const notification = await Notification.findOneAndDelete({
			_id: req.params.id,
			user: req.user.id
		});
		
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
		const count = await Notification.countDocuments({
			user: req.user.id,
			isRead: false
		});
		
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
			users = await User.find({ isActive: true });
		} else {
			users = await User.find({ role: targetRole, isActive: true });
		}
		
		const notifications = users.map(user => ({
			user: user._id,
			type,
			title,
			content,
			sentAt: scheduledAt || new Date(),
			scheduledBy: req.user.id
		}));
		
		await Notification.insertMany(notifications);
		
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
		
		const notification = await Notification.create({
			...notificationData,
			user: child.parent,
			child: child._id
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