const jwt = require('jsonwebtoken');
const Joi = require('joi');
const User = require('../models/NguoiDung');
const OTP = require('../models/MaXacNhan');
const { sendOTPEmail } = require('../services/emailService');

function signToken(user) {
	return jwt.sign({ 
		id: user._id, 
		vaiTro: user.vaiTro, 
		hoTen: user.hoTen 
	}, process.env.JWT_SECRET || 'secret', {
		expiresIn: process.env.JWT_EXPIRES_IN || '7d'
	});
}

function signRefreshToken(user) {
	return jwt.sign({ 
		id: user._id, 
		vaiTro: user.vaiTro 
	}, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'secret', {
		expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d'
	});
}

const register = async (req, res, next) => {
	try {
		const schema = Joi.object({
			hoTen: Joi.string().required(),
			email: Joi.string().email().required(),
			matKhau: Joi.string().min(6).required(),
			vaiTro: Joi.string().valid('phuHuynh', 'hocSinh', 'admin', 'giaoVien')
		}).messages({
			'string.email': 'Vui lòng nhập đúng định dạng email',
			'any.required': 'Vui lòng nhập {#label}',
			'string.min': 'Mật khẩu phải có ít nhất 6 ký tự'
		});
		const value = await schema.validateAsync(req.body);
		const exists = await User.findOne({ email: value.email });
		if (exists) return res.status(400).json({ success: false, message: 'Email đã tồn tại' });
		const user = await User.create(value);
		const token = signToken(user);
		const refreshToken = signRefreshToken(user);
		const userObj = user.toObject();
		userObj.id = userObj._id;
		delete userObj.matKhau;
		res.status(201).json({ 
			success: true, 
			data: { 
				token, 
				refreshToken, 
				user: userObj
			} 
		});
	} catch (err) {
		if (err.isJoi) {
			return res.status(400).json({
				success: false,
				message: err.details[0].message
			});
		}
		next(err);
	}
};

const login = async (req, res, next) => {
	try {
		const schema = Joi.object({ 
			email: Joi.string().email().required(), 
			matKhau: Joi.string().required()
		}).messages({
			'string.email': 'Vui lòng nhập đúng định dạng email',
			'any.required': 'Vui lòng nhập {#label}'
		});
		const { email, matKhau } = await schema.validateAsync(req.body);
		const user = await User.findOne({ email }).select('+matKhau');
		if (!user) return res.status(400).json({ success: false, message: 'Sai thông tin đăng nhập' });
		if (!user.trangThai) return res.status(400).json({ success: false, message: 'Tài khoản đã bị khóa' });
		const ok = await user.comparePassword(matKhau);
		if (!ok) return res.status(400).json({ success: false, message: 'Sai thông tin đăng nhập' });
		
		user.dangNhapCuoi = new Date();
		await user.save();
		
		const token = signToken(user);
		const refreshToken = signRefreshToken(user);
		const userObj = user.toObject();
		userObj.id = userObj._id;
		delete userObj.matKhau;
		
		res.json({ 
			success: true, 
			data: { 
				token, 
				refreshToken, 
				user: userObj
			} 
		});
	} catch (err) {
		if (err.isJoi) {
			return res.status(400).json({
				success: false,
				message: err.details[0].message
			});
		}
		next(err);
	}
};

const logout = async (req, res) => {
	res.json({ success: true, message: 'Đã đăng xuất' });
};
// kiểm tra định dạng email và email có tồn tại trong CSDL không, nếu có tạo OTP gửi thông qua mail service
const forgotPassword = async (req, res, next) => {
	try {
		const schema = Joi.object({ 
			email: Joi.string().email().required()
		}).messages({
			'string.email': 'Vui lòng nhập đúng định dạng email',
			'any.required': 'Vui lòng nhập email'
		});
		const { email } = await schema.validateAsync(req.body);
		
		const user = await User.findOne({ email });
		if (!user) {
			return res.status(400).json({ 
				success: false, 
				message: 'Email không tồn tại trong hệ thống' 
			});
		}

		const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
		const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
		
		try {
			await OTP.deleteMany({ email });
			
		await OTP.create({
			email,
			maOTP: otpCode,
			soLanThu: 0,
			hetHanVao: expiresAt
		});
		} catch (dbError) {
			return res.status(500).json({ 
				success: false, 
				message: 'Lỗi hệ thống. Vui lòng thử lại sau.' 
			});
		}

		try {
			const emailSent = await sendOTPEmail(email, otpCode);// service gửi OTP trong mail service
			
			if (!emailSent) {
				await OTP.deleteMany({ email });
				return res.status(500).json({ 
					success: false, 
					message: 'Không thể gửi email. Vui lòng thử lại sau.' 
				});
			}
		} catch (emailError) {
			await OTP.deleteMany({ email });
			if (emailError.message && emailError.message.includes('EMAIL_USER and EMAIL_PASSWORD')) {
				return res.status(500).json({ 
					success: false, 
					message: 'Lỗi rồi! Kiểm tra cáu hình email!' 
				});
			}
			return res.status(500).json({ 
				success: false, 
				message: 'Không thể gửi email. Vui lòng kiểm tra cấu hình email.' 
			});
		}

		res.json({ 
			success: true, 
			message: 'Mã xác nhận đã được gửi đến email của bạn' 
		});
	} catch (err) {
		if (err.isJoi || err.name === 'ValidationError') {
			const message = err.details && err.details[0] ? err.details[0].message : err.message;
			return res.status(400).json({
				success: false,
				message: message
			});
		}
		next(err);
	}
};

const verifyOTP = async (req, res, next) => {
	try {
		const schema = Joi.object({ 
			email: Joi.string().email().required(), 
			otp: Joi.string().length(6).required()
		}).messages({
			'string.email': 'Vui lòng nhập đúng định dạng email',
			'any.required': 'Vui lòng nhập {#label}',
			'string.length': 'Mã OTP phải có 6 số'
		});
		const { email, otp } = await schema.validateAsync(req.body);
		
		const otpRecord = await OTP.findOne({ email }).sort({ createdAt: -1 });
		
		if (!otpRecord) {
			return res.status(400).json({ 
				success: false, 
				message: 'Mã OTP không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu mã mới.' 
			});
		}

		if (otpRecord.lockedUntil && new Date() < otpRecord.lockedUntil) {
			const remainingSeconds = Math.ceil((otpRecord.lockedUntil - new Date()) / 1000);
			return res.status(400).json({ 
				success: false, 
				message: `Bạn đã nhập sai quá nhiều lần. Vui lòng đợi ${remainingSeconds} giây trước khi thử lại.`,
				lockedUntil: otpRecord.lockedUntil
			});
		}

		if (new Date() > otpRecord.expiresAt) {
			return res.status(400).json({ 
				success: false, 
				message: 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.' 
			});
		}

		if (otpRecord.maOTP !== otp) {
			const newAttempts = otpRecord.soLanThu + 1;
			
			if (newAttempts >= 3) {
				const lockedUntil = new Date(Date.now() + 60 * 1000);
				await OTP.findByIdAndUpdate(otpRecord._id, { 
					soLanThu: newAttempts,
					khoaDen: lockedUntil
				});
				
				return res.status(400).json({ 
					success: false, 
					message: 'Bạn đã nhập sai mã OTP 3 lần. Vui lòng đợi 60 giây trước khi thử lại.',
					lockedUntil
				});
			}

			await OTP.findByIdAndUpdate(otpRecord._id, { soLanThu: newAttempts });
			
			return res.status(400).json({ 
				success: false, 
				message: `Mã OTP không đúng. Bạn còn ${3 - newAttempts} lần thử.`,
				remainingAttempts: 3 - newAttempts
			});
		}

		res.json({ 
			success: true, 
			message: 'Mã OTP hợp lệ' 
		});
	} catch (err) {
		if (err.isJoi || err.name === 'ValidationError') {
			const message = err.details && err.details[0] ? err.details[0].message : err.message;
			return res.status(400).json({
				success: false,
				message: message
			});
		}
		next(err);
	}
};

const resetPassword = async (req, res, next) => {
	try {
		const schema = Joi.object({ 
			email: Joi.string().email().required(), 
			otp: Joi.string().length(6).required(),
			newPassword: Joi.string().min(6).required()
		}).messages({
			'string.email': 'Vui lòng nhập đúng định dạng email',
			'any.required': 'Vui lòng nhập {#label}',
			'string.length': 'Mã OTP phải có 6 số',
			'string.min': 'Mật khẩu phải có ít nhất 6 ký tự'
		});
		const { email, otp, newPassword: matKhauMoi } = await schema.validateAsync(req.body);
		
		const otpRecord = await OTP.findOne({ email }).sort({ createdAt: -1 });
		
		if (!otpRecord) {
			return res.status(400).json({ 
				success: false, 
				message: 'Mã OTP không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu mã mới.' 
			});
		}

		if (otpRecord.khoaDen && new Date() < otpRecord.khoaDen) {
			const remainingSeconds = Math.ceil((otpRecord.khoaDen - new Date()) / 1000);
			return res.status(400).json({ 
				success: false, 
				message: `Bạn đã nhập sai quá nhiều lần. Vui lòng đợi ${remainingSeconds} giây trước khi thử lại.`,
				lockedUntil: otpRecord.khoaDen
			});
		}

		if (new Date() > otpRecord.hetHanVao) {
			return res.status(400).json({ 
				success: false, 
				message: 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.' 
			});
		}

		if (otpRecord.maOTP !== otp) {
			const newAttempts = otpRecord.soLanThu + 1;
			
			if (newAttempts >= 3) {
				const lockedUntil = new Date(Date.now() + 60 * 1000);
				await OTP.findByIdAndUpdate(otpRecord._id, { 
					soLanThu: newAttempts,
					khoaDen: lockedUntil
				});
				
				return res.status(400).json({ 
					success: false, 
					message: 'Bạn đã nhập sai mã OTP 3 lần. Vui lòng đợi 60 giây trước khi thử lại.',
					lockedUntil
				});
			}

			await OTP.findByIdAndUpdate(otpRecord._id, { soLanThu: newAttempts });
			
			return res.status(400).json({ 
				success: false, 
				message: `Mã OTP không đúng. Bạn còn ${3 - newAttempts} lần thử.`,
				remainingAttempts: 3 - newAttempts
			});
		}

		const user = await User.findOne({ email }).select('+matKhau');
		if (!user) {
			return res.status(400).json({ 
				success: false, 
				message: 'Tài khoản không tồn tại' 
			});
		}

		user.matKhau = matKhauMoi;
		await user.save();

		await OTP.deleteMany({ email });

		res.json({ 
			success: true, 
			message: 'Đặt lại mật khẩu thành công' 
		});
	} catch (err) {
		if (err.isJoi || err.name === 'ValidationError') {
			const message = err.details && err.details[0] ? err.details[0].message : err.message;
			return res.status(400).json({
				success: false,
				message: message
			});
		}
		next(err);
	}
};

const refresh = async (req, res, next) => {
	try {
		const schema = Joi.object({ refreshToken: Joi.string().required() });
		const { refreshToken } = await schema.validateAsync(req.body);
		const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'secret');
		const user = await User.findById(payload.id);
		if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
		const token = signToken(user);
		res.json({ success: true, data: { token } });
	} catch (err) {
		next(err);
	}
};

const updateProfile = async (req, res, next) => {
	try {
		const schema = Joi.object({
			hoTen: Joi.string().optional(),
			thongTinCaNhan: Joi.object({
				anhDaiDien: Joi.string().uri().optional(),
				soDienThoai: Joi.string().optional(),
				diaChi: Joi.string().optional(),
				ngaySinh: Joi.date().optional(),
				gioiTinh: Joi.string().valid('nam', 'nu', 'khac').optional()
			}).optional(),
			caiDat: Joi.object({
				thongBao: Joi.boolean().optional(),
				ngonNgu: Joi.string().optional(),
				muiGio: Joi.string().optional()
			}).optional()
		});
		const updateData = await schema.validateAsync(req.body);
		const user = await User.findByIdAndUpdate(req.user.id, updateData, { new: true });
		const userObj = user.toObject();
		userObj.id = userObj._id;
		delete userObj.matKhau;
		res.json({ success: true, data: { user: userObj } });
	} catch (err) {
		next(err);
	}
};

const changePassword = async (req, res, next) => {
	try {
		const schema = Joi.object({
			matKhauHienTai: Joi.string().required(),
			matKhauMoi: Joi.string().min(6).required()
		});
		const { matKhauHienTai, matKhauMoi } = await schema.validateAsync(req.body);
		const user = await User.findById(req.user.id).select('+matKhau');
		const isCurrentPasswordValid = await user.comparePassword(matKhauHienTai);
		if (!isCurrentPasswordValid) {
			return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng' });
		}
		user.matKhau = matKhauMoi;
		await user.save();
		res.json({ success: true, message: 'Đổi mật khẩu thành công' });
	} catch (err) {
		next(err);
	}
};

const getProfile = async (req, res, next) => {
	try {
		const user = await User.findById(req.user.id);
		const userObj = user.toObject();
		userObj.id = userObj._id;
		delete userObj.matKhau;
		res.json({ success: true, data: { user: userObj } });
	} catch (err) {
		next(err);
	}
};

module.exports = { 
	register, 
	login, 
	logout, 
	forgotPassword,
	verifyOTP,
	resetPassword, 
	refresh, 
	updateProfile, 
	changePassword, 
	getProfile 
};
