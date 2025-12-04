const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const { 
	getStats, 
	getUsers, 
	getChildren, 
	getReports,
	getTrialAccounts,
	activateTrialAccount,
	deactivateTrialAccount,
	extendTrialPeriod,
	getTrialStats
} = require('../../controllers/adminController');
const router = express.Router();

router.use(authenticate);
router.use(authorize(['admin']));
router.get('/stats', getStats);
router.get('/users', getUsers);
router.get('/children', getChildren);
router.get('/reports', getReports);

router.get('/trial-accounts', getTrialAccounts);
router.get('/trial-stats', getTrialStats);
router.post('/trial-accounts/:userId/activate', activateTrialAccount);
router.post('/trial-accounts/:userId/deactivate', deactivateTrialAccount);
router.post('/trial-accounts/:userId/extend', extendTrialPeriod);

module.exports = router;