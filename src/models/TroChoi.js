const mongoose = require('mongoose');

const TroChoiSchema = new mongoose.Schema(
	{
		ma: { type: String, required: true, unique: true },
		loai: { type: String, enum: ['toMau', 'xepHinh', 'ghepDoi', 'doan'], required: true },
		tieuDe: { type: String, required: true },
		moTa: String,
		danhMuc: { type: String, enum: ['chuCai', 'so', 'mauSac', 'hanhDong'], required: true },
		capDo: { 
			type: String, 
			enum: ['coBan', 'trungBinh', 'nangCao'], 
			default: 'coBan' 
		},
		duLieu: {
			huongDan: String,
			vatPham: [{
				id: String,
				anhDaiDien: String,
				vanBan: String,
				amThanh: String,
				viTri: { x: Number, y: Number }
			}],
			diemSo: {
				diemMoiVatPham: { type: Number, default: 10 },
				diemThoiGian: { type: Number, default: 5 },
				diemToiDa: { type: Number, default: 100 }
			},
			manhXepHinh: [{
				id: String,
				anhDaiDien: String,
				viTriDung: { x: Number, y: Number }
			}],
			cauHoi: [{
				id: String,
				anhDaiDien: String,
				phuongTien: String,
				loaiPhuongTien: { type: String, enum: ['anh', 'video', 'gif'] }, 
				cauHoi: String,
				phuongAn: [String],
				dapAnDung: String,
				giaiThich: String
			}],
			anhGoc: String,
			manh: [mongoose.Schema.Types.Mixed],
			hang: Number,
			cot: Number,
			duLieuToMau: {
				anhVien: String, 
				mauGợiY: [String], 
				vungMau: [{
					id: String,
					duongDan: String, 
					mauGợiY: String
				}]
			},
			capGhepDoi: [{
				id: String,
				vanBan: String,
				anhDaiDien: String,
				amThanh: String,
				viTri: { x: Number, y: Number }
			}]
		},
		anhDaiDien: String,
		thoiGianUocTinh: { type: Number, default: 5 },
		doTuoi: {
			toiThieu: { type: Number, default: 3 },
			toiDa: { type: Number, default: 6 }
		},
		lop: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lop' }],
		nguoiTao: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung' },
		trangThai: { type: Boolean, default: true }
	},
	{ timestamps: true }
);

module.exports = mongoose.model('TroChoi', TroChoiSchema);

