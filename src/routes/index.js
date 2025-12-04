const express = require('express');
const router = express.Router();

router.use('/auth', require('./modules/auth'));
router.use('/users', require('./modules/users'));
router.use('/children', require('./modules/children'));
router.use('/lessons', require('./modules/lessons'));
router.use('/games', require('./modules/games'));
router.use('/progress', require('./modules/progress'));
router.use('/reports', require('./modules/reports'));
router.use('/notifications', require('./modules/notifications'));
router.use('/admin', require('./modules/admin'));
router.use('/app-sessions', require('./modules/appSessions'));
router.use('/classes', require('./modules/classes'));

module.exports = router;
