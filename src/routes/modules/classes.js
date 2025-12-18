const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const {
	listClasses,
	getClassById,
	createClass,
	updateClass,
	deleteClass,
	addTeacher,
	addStudent,
	removeStudent,
	getClassProgress,
	getStudentProgress,
	createLessonInClass,
	updateLessonInClass,
	createGameInClass,
	getClassLessonsWithStats,
	exportStudentReport,
	sendStudentReportEmail
} = require('../../controllers/classController');
const router = express.Router();

router.use(authenticate);

router.get('/', authorize(['admin', 'giaoVien']), listClasses);
router.get('/:id', authorize(['admin', 'giaoVien']), getClassById);
router.post('/', authorize(['admin']), createClass);
router.put('/:id', authorize(['admin', 'giaoVien']), updateClass);
router.delete('/:id', authorize(['admin', 'giaoVien']), deleteClass);
router.post('/:id/teacher', authorize(['admin']), addTeacher);
router.post('/:id/students', authorize(['admin', 'giaoVien']), addStudent);
router.delete('/:id/students/:studentId', authorize(['admin', 'giaoVien']), removeStudent);
router.get('/:id/progress', authorize(['admin', 'giaoVien']), getClassProgress);
router.get('/:id/lessons/stats', authorize(['admin', 'giaoVien']), getClassLessonsWithStats);
router.get('/:id/students/:studentId/progress', authorize(['admin', 'giaoVien']), getStudentProgress);
router.get('/:id/students/:studentId/report/pdf', authorize(['admin', 'giaoVien']), exportStudentReport);
router.get('/:id/students/:studentId/report/send-email', authorize(['admin', 'giaoVien']), sendStudentReportEmail);
router.post('/:id/lessons', authorize(['admin', 'giaoVien']), createLessonInClass);
router.put('/:id/lessons/:lessonId', authorize(['admin', 'giaoVien']), updateLessonInClass);
router.post('/:id/games', authorize(['admin', 'giaoVien']), createGameInClass);

module.exports = router;

