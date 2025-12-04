const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const { generateReport, getReports, getReportById, deleteReport } = require('../../controllers/reportController');
const router = express.Router();

router.use(authenticate);
router.post('/generate', authorize(['parent','admin']), generateReport);
router.get('/', authorize(['parent','admin']), getReports);
router.get('/:id', authorize(['parent','admin']), getReportById);
router.delete('/:id', authorize(['parent','admin']), deleteReport);

module.exports = router;