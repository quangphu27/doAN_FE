const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const { 
	startSession, 
	endSession,
	getChildSessions,
	getTotalUsageTime,
	getLastActivityTime
} = require('../../controllers/appSessionController');
const router = express.Router();

router.use(authenticate);

const canManageSession = (req, res, next) => {
	if (req.user.vaiTro === 'hocSinh' && req.body.childId === req.user.id) {
		return next();
	}
	if (req.user.vaiTro === 'phuHuynh' || req.user.vaiTro === 'admin') {
		return next();
	}
	return res.status(403).json({ success: false, message: 'Unauthorized' });
};
// tuong ưng day la cac route ơ bacnend ma frontend goi toi - phần endpoint route 
router.post('/start', canManageSession, startSession);// Canmangesession (middleware chỉ ai có quyen child moi duoc vao)
router.post('/end', canManageSession, endSession);

router.get('/child/:childId', authorize(['phuHuynh', 'admin']), getChildSessions);
router.get('/child/:childId/total-time', authorize(['phuHuynh', 'admin']), getTotalUsageTime);
router.get('/child/:childId/last-activity', authorize(['phuHuynh', 'admin']), getLastActivityTime);

module.exports = router;

