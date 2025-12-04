const nodemailer = require('nodemailer');

let transporter = null;

const createTransporter = () => {
	const emailUser = process.env.EMAIL_USER;
	const emailPass = process.env.EMAIL_PASSWORD;
	
	if (!emailUser || !emailPass) {
		throw new Error('EMAIL_USER and EMAIL_PASSWORD must be set in environment variables');
	}
	
	return nodemailer.createTransport({
		service: 'gmail',
		auth: {
			user: emailUser,
			pass: emailPass
		}
	});
};

const getTransporter = () => {
	if (!transporter) {
		transporter = createTransporter();
	}
	return transporter;
};
// nó ở đây
const sendOTPEmail = async (email, otp) => {
	try {
		const mailTransporter = getTransporter();
		const mailOptions = {
			from: process.env.EMAIL_USER,
			to: email,
			subject: 'Mã xác nhận đặt lại mật khẩu',
			html: `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
					<h2 style="color: #2196F3;">Đặt lại mật khẩu</h2>
					<p>Xin chào,</p>
					<p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản của mình.</p>
					<p style="font-size: 24px; font-weight: bold; color: #2196F3; text-align: center; padding: 20px; background-color: #f5f5f5; border-radius: 8px; margin: 20px 0;">
						${otp}
					</p>
					<p>Mã này có hiệu lực trong 10 phút.</p>
					<p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
					<hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
					<p style="color: #666; font-size: 12px;">Đây là email tự động, vui lòng không trả lời.</p>
				</div>
			`
		};

		await mailTransporter.sendMail(mailOptions);
		return true;
	} catch (error) {
		if (error.message && error.message.includes('EMAIL_USER and EMAIL_PASSWORD')) {
			throw error;
		}
		return false;
	}
};

module.exports = {
	sendOTPEmail
};

