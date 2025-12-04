const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const NguoiDungSchema = new mongoose.Schema(
	{
		hoTen: { type: String, required: true },
		email: { type: String, required: true, unique: true, lowercase: true },
		matKhau: { type: String, required: true, select: false },
		vaiTro: { type: String, enum: ['admin', 'phuHuynh', 'giaoVien', 'hocSinh'], default: 'phuHuynh' },
		thongTinCaNhan: {
			anhDaiDien: String,
			soDienThoai: String,
			diaChi: String,
			ngaySinh: Date,
			gioiTinh: { type: String, enum: ['nam', 'nu', 'khac'] }
		},
		caiDat: {
			thongBao: { type: Boolean, default: true },
			ngonNgu: { type: String, default: 'vi' },
			muiGio: { type: String, default: 'Asia/Ho_Chi_Minh' }
		},
		trangThai: { type: Boolean, default: true },
		dangNhapCuoi: Date,
		taiKhoanDungThu: { type: Boolean, default: true },
		ngayBatDauDungThu: { type: Date, default: Date.now },
		ngayKetThucDungThu: { type: Date },
		daKichHoat: { type: Boolean, default: false }
	},
	{ timestamps: true }
);

NguoiDungSchema.pre('save', async function (next) {
	if (!this.isModified('matKhau')) return next();
	const salt = await bcrypt.genSalt(10);
	this.matKhau = await bcrypt.hash(this.matKhau, salt);
	next();
});

NguoiDungSchema.pre('save', function (next) {
	if (this.isNew && this.vaiTro !== 'admin' && this.vaiTro !== 'giaoVien' && this.taiKhoanDungThu && !this.ngayKetThucDungThu) {
		this.ngayKetThucDungThu = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
	}
	if (this.isNew && (this.vaiTro === 'admin' || this.vaiTro === 'giaoVien')) {
		this.taiKhoanDungThu = false;
		this.daKichHoat = true;
	}
	next();
});

NguoiDungSchema.methods.comparePassword = function (candidate) {
	return bcrypt.compare(candidate, this.matKhau);
};

NguoiDungSchema.methods.isTrialValid = function () {
	if (this.vaiTro === 'admin' || this.vaiTro === 'giaoVien') {
		return true;
	}
	if (!this.taiKhoanDungThu || this.daKichHoat) {
		return true;
	}
	return new Date() <= this.ngayKetThucDungThu;
};

NguoiDungSchema.methods.getTrialStatus = function () {
	if (this.vaiTro === 'admin') {
		return {
			isTrial: false,
			isValid: true,
			daysRemaining: null,
			message: 'Tài khoản quản trị viên'
		};
	}
	if (this.vaiTro === 'giaoVien') {
		return {
			isTrial: false,
			isValid: true,
			daysRemaining: null,
			message: 'Tài khoản giáo viên'
		};
	}
	
	if (!this.taiKhoanDungThu || this.daKichHoat) {
		return {
			isTrial: false,
			isValid: true,
			daysRemaining: null,
			message: 'Tài khoản đã được kích hoạt'
		};
	}
	
	const now = new Date();
	const daysRemaining = Math.ceil((this.ngayKetThucDungThu - now) / (1000 * 60 * 60 * 24));
	const isValid = now <= this.ngayKetThucDungThu;
	
	return {
		isTrial: true,
		isValid,
		daysRemaining: Math.max(0, daysRemaining),
		message: isValid 
			? `Tài khoản dùng thử còn ${daysRemaining} ngày`
			: 'Tài khoản dùng thử đã hết hạn'
	};
};

module.exports = mongoose.model('NguoiDung', NguoiDungSchema);

