const mongoose = require('mongoose');

const LichHocSchema = new mongoose.Schema(
	{
		phuHuynh: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', required: true },
		treEm: { type: mongoose.Schema.Types.ObjectId, ref: 'TreEm' },
		ngayTrongTuan: [{ type: Number, min: 0, max: 6 }], 
		gioTrongNgay: { type: String, required: true }, 
		soPhienMoiTuan: { type: Number, default: 3, min: 1, max: 7 },
		thoiGian: { type: Number, default: 30 }, 
		trangThai: { type: Boolean, default: true }
	},
	{ timestamps: true }
);

const ThongBaoSchema = new mongoose.Schema(
	{
		nguoiDung: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', required: true },
		treEm: { type: mongoose.Schema.Types.ObjectId, ref: 'TreEm' },
		loai: { 
			type: String, 
			enum: ['nhacNho', 'tomTat', 'thanhTich', 'heThong', 'lichHoc'], 
			required: true 
		},
		tieuDe: { type: String, required: true },
		noiDung: { type: String, required: true },
		duLieu: {
			idBaiHoc: { type: mongoose.Schema.Types.ObjectId, ref: 'BaiHoc' },
			idTroChoi: { type: mongoose.Schema.Types.ObjectId, ref: 'TroChoi' },
			diemSo: Number,
			thanhTich: String
		},
		daDoc: { type: Boolean, default: false },
		ngayGui: Date,
		ngayDoc: Date
	},
	{ timestamps: true }
);

module.exports = {
	LichHoc: mongoose.model('LichHoc', LichHocSchema),
	ThongBao: mongoose.model('ThongBao', ThongBaoSchema)
};

