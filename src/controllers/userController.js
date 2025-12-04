const Joi = require('joi');
const User = require('../models/NguoiDung');
const bcrypt = require('bcryptjs');

const listUsers = async (req, res, next) => {
	try {
	const { vaiTro, trangThai, search } = req.query;
	const filter = {};
	if (vaiTro) filter.vaiTro = vaiTro;
	if (trangThai !== undefined) filter.trangThai = trangThai === 'true';
	if (search) {
		filter.$or = [
			{ hoTen: { $regex: search, $options: 'i' } },
			{ email: { $regex: search, $options: 'i' } }
		];
	}

	const users = await User.find(filter)
		.select('-matKhau')
		.sort({ createdAt: -1 })
		.limit(parseInt(req.query.limit || 20))
		.skip((parseInt(req.query.page || 1) - 1) * parseInt(req.query.limit || 20));

	const total = await User.countDocuments(filter);

	const usersData = users.map(u => {
		const userObj = u.toObject();
		userObj.id = userObj._id;
		delete userObj.matKhau;
		return userObj;
	});

	res.json({
		success: true,
		data: usersData,
		pagination: {
			total,
			page: parseInt(req.query.page || 1),
			limit: parseInt(req.query.limit || 20),
			pages: Math.ceil(total / parseInt(req.query.limit || 20))
		}
	});
	} catch (e) {
		next(e);
	}
};

const getUserById = async (req, res, next) => {
	try {
	const user = await User.findById(req.params.id).select('-matKhau');
	if (!user) {
		return res.status(404).json({ success: false, message: 'User not found' });
	}
	const userObj = user.toObject();
	userObj.id = userObj._id;
	delete userObj.matKhau;
	res.json({ success: true, data: userObj });
	} catch (e) {
		next(e);
	}
};

const createUser = async (req, res, next) => {
	try {
	const schema = Joi.object({
		hoTen: Joi.string().required(),
		email: Joi.string().email().required(),
		matKhau: Joi.string().min(6).required(),
		vaiTro: Joi.string().valid('admin', 'phuHuynh', 'hocSinh', 'giaoVien').required(),
		thongTinCaNhan: Joi.object({
			anhDaiDien: Joi.string().allow('').optional(),
			soDienThoai: Joi.string().allow('').optional(),
			diaChi: Joi.string().allow('').optional(),
			ngaySinh: Joi.date().allow(null).optional(),
			gioiTinh: Joi.string().valid('nam', 'nu', 'khac').optional()
		}).optional(),
		caiDat: Joi.object({
			thongBao: Joi.boolean().optional(),
			ngonNgu: Joi.string().optional(),
			muiGio: Joi.string().optional()
		}).optional()
	}).messages({
		'string.email': 'Vui lòng nhập đúng định dạng email',
		'any.required': 'Vui lòng nhập {#label}',
		'string.min': 'Mật khẩu phải có ít nhất 6 ký tự'
	});

	const userData = await schema.validateAsync(req.body);
	
	const exists = await User.findOne({ email: userData.email });
	if (exists) {
		return res.status(400).json({ success: false, message: 'Email đã tồn tại' });
	}
	
	const user = await User.create(userData);
	const userObj = user.toObject();
	userObj.id = userObj._id;
	delete userObj.matKhau;
	res.status(201).json({ success: true, data: userObj });
	} catch (e) {
		if (e.isJoi) {
			return res.status(400).json({
				success: false,
				message: e.details[0].message
			});
		}
		if (e.code === 11000) {
			return res.status(400).json({
				success: false,
				message: 'Email đã tồn tại'
			});
		}
		next(e);
	}
};

const updateUser = async (req, res, next) => {
	try {
	const schema = Joi.object({
		hoTen: Joi.string().optional(),
		email: Joi.string().email().optional(),
		vaiTro: Joi.string().valid('admin', 'phuHuynh', 'hocSinh', 'giaoVien').optional(),
		trangThai: Joi.boolean().optional(),
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
	const user = await User.findByIdAndUpdate(
		req.params.id,
		updateData,
		{ new: true }
	).select('-matKhau');

	if (!user) {
		return res.status(404).json({ success: false, message: 'User not found' });
	}

	const userObj = user.toObject();
	userObj.id = userObj._id;
	delete userObj.matKhau;
	res.json({ success: true, data: userObj });
	} catch (e) {
		next(e);
	}
};

const deleteUser = async (req, res, next) => {
	try {
		const user = await User.findByIdAndDelete(req.params.id);
		if (!user) {
			return res.status(404).json({ success: false, message: 'User not found' });
		}
		res.json({ success: true, message: 'User deleted successfully' });
	} catch (e) {
		next(e);
	}
};

const resetUserPassword = async (req, res, next) => {
	try {
	const schema = Joi.object({
		matKhauMoi: Joi.string().min(6).required()
	});
	const { matKhauMoi } = await schema.validateAsync(req.body);

	const user = await User.findById(req.params.id);
	if (!user) {
		return res.status(404).json({ success: false, message: 'User not found' });
	}

	user.matKhau = matKhauMoi;
	await user.save();

	res.json({ success: true, message: 'Password reset successfully' });
	} catch (e) {
		next(e);
	}
};

module.exports = {
	listUsers,
	getUserById,
	createUser,
	updateUser,
	deleteUser,
	resetUserPassword
};