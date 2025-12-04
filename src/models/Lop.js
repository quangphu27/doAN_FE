const mongoose = require('mongoose');

const LopSchema = new mongoose.Schema(
	{
		tenLop: { type: String, required: true },
		moTa: String,
		giaoVien: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', required: true },
		hocSinh: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TreEm' }],
		baiTap: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BaiHoc' }],
		troChoi: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TroChoi' }],
		maLop: { type: String, unique: true, sparse: true },
		trangThai: { type: Boolean, default: true },
		ngayBatDau: { type: Date, default: Date.now },
		ngayKetThuc: Date
	},
	{ timestamps: true }
);

LopSchema.pre('save', function(next) {
	if (!this.maLop) {
		this.maLop = 'LOP' + Math.random().toString(36).substring(2, 9).toUpperCase();
	}
	next();
});

module.exports = mongoose.model('Lop', LopSchema);

