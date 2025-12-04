const mongoose = require('mongoose');

const MaXacNhanSchema = new mongoose.Schema(
	{
		email: { type: String, required: true, index: true },
		maOTP: { type: String, required: true },
		soLanThu: { type: Number, default: 0 },
		khoaDen: { type: Date, default: null },
		hetHanVao: { type: Date, required: true, index: { expireAfterSeconds: 0 } }
	},
	{ timestamps: true }
);

MaXacNhanSchema.index({ email: 1, createdAt: -1 });

module.exports = mongoose.model('MaXacNhan', MaXacNhanSchema);

