const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const { 
	getProgressById,
	getProgressByChild, 
	updateProgress, 
	getProgressStats, 
	getRecentProgress,
	recordGameResult,
	recordLessonResult,
	getChildAchievements,
	getChildDetailReport
} = require('../../controllers/progressController');
const router = express.Router();

router.use(authenticate);
router.get('/:id', authorize(['phuHuynh','hocSinh','admin']), getProgressById);
router.get('/child/:childId', authorize(['phuHuynh','admin']), getProgressByChild);
router.put('/child/:childId', authorize(['phuHuynh','admin']), updateProgress);
router.get('/child/:childId/stats', authorize(['phuHuynh','admin']), getProgressStats);
router.get('/child/:childId/recent', authorize(['phuHuynh','admin']), getRecentProgress);
router.get('/child/:childId/achievements', authorize(['phuHuynh','admin','hocSinh']), getChildAchievements);
router.get('/child/:childId/detail', authorize(['phuHuynh','admin']), getChildDetailReport);
router.post('/game', authorize(['phuHuynh','hocSinh','admin']), recordGameResult);
router.post('/lesson', authorize(['phuHuynh','hocSinh','admin']), recordLessonResult);
router.get('/stats/:userId', getProgressStats);
router.get('/recent/:userId', getRecentProgress);

module.exports = router;
