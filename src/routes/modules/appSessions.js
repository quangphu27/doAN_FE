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
	const role = req.user.vaiTro;
	const isChild = role === 'hocSinh' || role === 'child';
	const isParent = role === 'phuHuynh' || role === 'parent';
	const isAdmin = role === 'admin';

	if (isChild) {
		return next();
	}
	if (isParent || isAdmin) {
		return next();
	}
	return res.status(403).json({ success: false, message: 'Unauthorized' });
};
router.post('/start', canManageSession, startSession);// Canmangesession (middleware chỉ ai có quyen child moi duoc vao)
router.post('/end', canManageSession, endSession);

router.get(
	'/child/:childId', 
	authorize(['phuHuynh', 'parent', 'admin']), 
	getChildSessions
);
router.get(
	'/child/:childId/total-time', 
	authorize(['phuHuynh', 'parent', 'admin']), 
	getTotalUsageTime
);
router.get(
	'/child/:childId/last-activity', 
	authorize(['phuHuynh', 'parent', 'admin']), 
	getLastActivityTime
);

module.exports = router;

