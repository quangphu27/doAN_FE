const express = require('express');
const { register, login, logout, forgotPassword, verifyOTP, resetPassword, refresh, updateProfile, changePassword, getProfile } = require('../../controllers/authController');
const { authenticate } = require('../../middleware/auth');
const router = express.Router();

router.post('/register', register);
//gọi route này ở backend xử lý
router.post('/login', login);
// tương tứng ở Backend
router.post('/forgot-password', forgotPassword);
// khi gửi xong gọi route verify để kiểm tra đúng ko
router.post('/verify-otp', verifyOTP);
// nếu đúng thì thông báo đến FE để hiển thị form đổi mật khẩu
router.post('/reset-password', resetPassword);
router.post('/refresh', refresh);

router.use(authenticate);
router.post('/logout', logout);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);

module.exports = router;
