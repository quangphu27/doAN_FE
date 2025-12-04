const mongoose = require('mongoose');

const LoiMoiSchema = new mongoose.Schema(
	{
		phuHuynh: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', required: true },
		emailTreEm: { type: String, required: true },
		tenTreEm: { type: String, required: true },
		tinNhan: { type: String, optional: true },
		trangThai: { 
			type: String, 
			enum: ['choXuLy', 'daChapNhan', 'daTuChoi', 'hetHan'], 
			default: 'choXuLy' 
		},
		maLoiMoi: { type: String, required: true, unique: true },
		hetHanVao: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
		chapNhanVao: Date,
		tuChoiVao: Date
	},
	{ timestamps: true }
);

LoiMoiSchema.pre('save', function(next) {
	if (!this.maLoiMoi) {
		this.maLoiMoi = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
	}
	next();
});

module.exports = mongoose.model('LoiMoi', LoiMoiSchema);

