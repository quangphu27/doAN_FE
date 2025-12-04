const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const { listUsers, getUserById, createUser, updateUser, deleteUser, resetUserPassword } = require('../../controllers/userController');
const router = express.Router();
router.use(authenticate);

router.get('/', authorize(['admin']), listUsers);
router.get('/:id', authorize(['admin']), getUserById);
router.post('/', authorize(['admin']), createUser);
router.put('/:id', authorize(['admin']), updateUser);
router.delete('/:id', authorize(['admin']), deleteUser);
router.put('/:id/reset-password', authorize(['admin']), resetUserPassword);

module.exports = router;