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
		dangNhapCuoi: Date
	},
	{ timestamps: true }
);

NguoiDungSchema.pre('save', async function (next) {
	if (!this.isModified('matKhau')) return next();
	const salt = await bcrypt.genSalt(10);
	this.matKhau = await bcrypt.hash(this.matKhau, salt);
	next();
});


NguoiDungSchema.methods.comparePassword = function (candidate) {
	return bcrypt.compare(candidate, this.matKhau);
};

module.exports = mongoose.model('NguoiDung', NguoiDungSchema);

