const mongoose = require('mongoose');

let isConnected = false;

async function connectDatabase() {
  if (isConnected) return;

	const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hotrohoctap';  await mongoose.connect(uri, { dbName: 'hotrohoctap' });

  isConnected = true;
  console.log('✅ MongoDB connected successfully');
}

module.exports = { connectDatabase };
