const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const { 
	getStats, 
	getUsers, 
	getChildren, 
	getReports,
	getActiveChildren
} = require('../../controllers/adminController');
const router = express.Router();

router.use(authenticate);
router.use(authorize(['admin']));
router.get('/stats', getStats);
router.get('/users', getUsers);
router.get('/children', getChildren);
router.get('/active-children', getActiveChildren);
router.get('/reports', getReports);

module.exports = router;