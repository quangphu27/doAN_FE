const mongoose = require('mongoose');

const BaiHocSchema = new mongoose.Schema(
	{
		danhMuc: { type: String, enum: ['chuCai', 'so', 'mauSac', 'hanhDong'], required: true },
		tieuDe: { type: String, required: true },
		moTa: String,
		anhDaiDien: String,
		amThanh: String,
		noiDung: {
			vanBan: String,
			viDu: [String],
			baiTap: [{
				_id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
				loai: { type: String, enum: ['tracNghiem', 'keoTha', 'ghepDoi', 'toMau', 'dienKhuyet'] },
				cauHoi: String,
				phuongAn: [String],
				dapAnDung: mongoose.Schema.Types.Mixed,
				anhDaiDien: String,
				vanBan: String,
				oTrong: [{
					viTri: Number,
					dapAnDung: String,
					phuongAn: [String]
				}]
			}]
		},
		capDo: { 
			type: String, 
			enum: ['coBan', 'trungBinh', 'nangCao'], 
			default: 'coBan' 
		},
		thuTu: Number,
		thoiGianUocTinh: { type: Number, default: 10 }, 
		dieuKienTienQuyet: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BaiHoc' }],
		lop: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lop' }],
		nguoiTao: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung' },
		trangThai: { type: Boolean, default: true }
	},
	{ timestamps: true }
);

module.exports = mongoose.model('BaiHoc', BaiHocSchema);

