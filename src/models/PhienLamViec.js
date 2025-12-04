const mongoose = require('mongoose');

const PhienLamViecSchema = new mongoose.Schema(
	{
		treEm: { 
			type: mongoose.Schema.Types.ObjectId, 
			ref: 'TreEm', 
			required: true 
		},
		thoiGianBatDau: { 
			type: Date, 
			required: true 
		},
		thoiGianKetThuc: { 
			type: Date, 
			required: false 
		},
		thoiGian: { 
			type: Number, 
			default: 0 
		},
		trangThai: { 
			type: String, 
			enum: ['dangHoatDong', 'hoanThanh'], 
			default: 'dangHoatDong' 
		}
	},
	{ timestamps: true }
);

PhienLamViecSchema.index({ treEm: 1, thoiGianBatDau: -1 });
PhienLamViecSchema.index({ treEm: 1, trangThai: 1 });

module.exports = mongoose.model('PhienLamViec', PhienLamViecSchema);

