const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const { 
	listChildren, 
	createChild, 
	updateChild, 
	deleteChild, 
	getProgress, 
	updateProgress, 
	getChildById, 
	getChildStats, 
	linkChildToParent,
	getChildActivities,
	getChildGameResults,
	inviteChildByEmail,
	getInvitations
} = require('../../controllers/childController');
const router = express.Router();

router.use(authenticate);
router.post('/invite', authorize(['phuHuynh','admin']), inviteChildByEmail);
router.get('/invitations', authorize(['phuHuynh','admin']), getInvitations);
router.get('/', authorize(['phuHuynh','admin']), listChildren);
router.post('/', authorize(['phuHuynh','admin']), createChild);
router.get('/:id', authorize(['phuHuynh','admin']), getChildById);
router.put('/:id', authorize(['phuHuynh','admin']), updateChild);
router.delete('/:id', authorize(['phuHuynh','admin']), deleteChild);
router.get('/:id/progress', authorize(['phuHuynh','admin']), getProgress);
router.put('/:id/progress', authorize(['phuHuynh','admin']), updateProgress);
router.get('/:id/stats', authorize(['phuHuynh','admin']), getChildStats);
router.get('/:childId/activities', authorize(['phuHuynh','admin']), getChildActivities);
router.get('/:childId/game-results', authorize(['phuHuynh','admin']), getChildGameResults);
router.post('/link', authorize(['phuHuynh','admin']), linkChildToParent);

module.exports = router;
