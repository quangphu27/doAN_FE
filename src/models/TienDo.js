const mongoose = require('mongoose');

const TienDoSchema = new mongoose.Schema(
	{
		treEm: { type: mongoose.Schema.Types.ObjectId, ref: 'TreEm', required: true },
		baiHoc: { type: mongoose.Schema.Types.ObjectId, ref: 'BaiHoc', required: false },
		troChoi: { type: mongoose.Schema.Types.ObjectId, ref: 'TroChoi', required: false },
		trangThai: { 
			type: String, 
			enum: ['chuaBatDau', 'dangThucHien', 'hoanThanh'], 
			default: 'chuaBatDau' 
		},
		diemSo: { type: Number, default: 0 },
		thoiGianDaDung: { type: Number, default: 0 }, 
		soLanThu: { type: Number, default: 0 },
		ngayHoanThanh: Date,
		ghiChu: String,
		tepKetQua: String,
		duLieuKetQua: mongoose.Schema.Types.Mixed,
		cauTraLoi: [{
			idBaiTap: { type: String, required: true },
			cauTraLoi: { type: String, required: true },
			dung: { type: Boolean, required: true }
		}],
		loai: { type: String, enum: ['baiHoc', 'troChoi'], default: 'baiHoc' },
		// Chấm điểm thủ công của giáo viên (dùng cho game tô màu, bài tự luận, ...)
		trangThaiChamDiem: { 
			type: String, 
			enum: ['chuaCham', 'daCham'], 
			default: 'chuaCham' 
		},
		diemGiaoVien: { type: Number, default: null }
	},
	{ timestamps: true }
);

TienDoSchema.index({ treEm: 1, baiHoc: 1 }, { unique: true, partialFilterExpression: { baiHoc: { $exists: true } } });
TienDoSchema.index({ treEm: 1, troChoi: 1 }, { unique: true, partialFilterExpression: { troChoi: { $exists: true } } });

module.exports = mongoose.model('TienDo', TienDoSchema);

	