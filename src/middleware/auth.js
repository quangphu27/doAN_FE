const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
	const header = req.headers.authorization || '';
	const token = header.startsWith('Bearer ') ? header.substring(7) : null;
	if (!token) {
		return res.status(401).json({ success: false, message: 'Unauthorized' });
	}
	try {
		const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
		req.user = payload;
		next();
	} catch (e) {
		return res.status(401).json({ success: false, message: 'Invalid token' });
	}
}

function authorize(vaiTros = []) {
	return (req, res, next) => {
		if (!vaiTros.length) return next();
		if (!req.user || !vaiTros.includes(req.user.vaiTro)) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}
		next();
	};
}

module.exports = { authenticate, authorize };
