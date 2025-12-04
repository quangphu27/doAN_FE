const mongoose = require('mongoose');

const BaoCaoSchema = new mongoose.Schema(
	{
		treEm: { type: mongoose.Schema.Types.ObjectId, ref: 'TreEm', required: true },
		phuHuynh: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', required: true },
		chuKy: { 
			type: String, 
			enum: ['hangNgay', 'hangTuan', 'hangThang'], 
			required: true 
		},
		ngayBatDau: { type: Date, required: true },
		ngayKetThuc: { type: Date, required: true },
		tomTat: {
			tongBaiHoc: { type: Number, default: 0 },
			baiHocHoanThanh: { type: Number, default: 0 },
			tongTroChoi: { type: Number, default: 0 },
			troChoiHoanThanh: { type: Number, default: 0 },
			diemTrungBinh: { type: Number, default: 0 },
			thoiGianDaDung: { type: Number, default: 0 }, 
			uDiem: [String],
			canCaiThien: [String]
		},
		khuyenNghiAI: {
			buocTiepTheo: [String],
			khuVucCanTapTrung: [String],
			khuyenKhich: String
		},
		ngayTao: { type: Date, default: Date.now }
	},
	{ timestamps: true }
);

module.exports = mongoose.model('BaoCao', BaoCaoSchema);

