const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const { 
	getNotifications, 
	markAsRead, 
	markAllAsRead, 
	createNotification, 
	deleteNotification, 
	getUnreadCount,
	sendNotificationToAll,
	sendNotificationToChild,
	getNotificationHistory
} = require('../../controllers/notificationController');
const router = express.Router();

router.use(authenticate);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/:id/read', markAsRead);
router.put('/read-all', markAllAsRead);
router.delete('/:id', deleteNotification);
router.post('/send-to-all', authorize(['admin']), sendNotificationToAll);
router.post('/send-to-child', authorize(['admin']), sendNotificationToChild);
router.post('/', authorize(['admin']), createNotification);
router.get('/history', authorize(['admin']), getNotificationHistory);

module.exports = router;