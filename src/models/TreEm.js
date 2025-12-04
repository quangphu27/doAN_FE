const mongoose = require('mongoose');

const TreEmSchema = new mongoose.Schema(
	{
		hoTen: { type: String, required: true },
		ngaySinh: { type: Date, required: false },
		gioiTinh: { type: String, enum: ['nam', 'nu'], required: true },
		anhDaiDien: String,
		phongHoc: { type: String },
		lop: { type: mongoose.Schema.Types.ObjectId, ref: 'Lop' },
		phuHuynh: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', required: true },
		capDoHocTap: { 
			type: String, 
			enum: ['coBan', 'trungBinh', 'nangCao'], 
			default: 'coBan' 
		},
		soThich: {
			mauSacYeuThich: [String],
			hoatDongYeuThich: [String],
			phongCachHocTap: { type: String, enum: ['thịGiac', 'thinhGiac', 'vanDong'] }
		},
		trangThai: { type: Boolean, default: true }
	},
	{ timestamps: true }
);

module.exports = mongoose.model('TreEm', TreEmSchema);

