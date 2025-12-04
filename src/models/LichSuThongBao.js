const mongoose = require('mongoose');

const LichSuThongBaoSchema = new mongoose.Schema(
	{
		nguoiGui: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', required: true },
		loai: {
			type: String,
			enum: ['nhacNho', 'tomTat', 'thanhTich', 'heThong', 'lichHoc'],
			required: true
		},
		tieuDe: { type: String, required: true },
		noiDung: { type: String, required: true },
		vaiTroNhan: { type: String, enum: ['tatCa', 'phuHuynh', 'giaoVien', 'hocSinh'], default: 'tatCa' },
		soLuongNhan: { type: Number, required: true },
		ngayLapLich: { type: Date, default: Date.now },
		trangThai: { type: String, enum: ['daGui', 'daLapLich', 'thatBai'], default: 'daGui' },
		thongBaoLoi: String
	},
	{ timestamps: true }
);

module.exports = mongoose.model('LichSuThongBao', LichSuThongBaoSchema);

