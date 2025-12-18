const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Tạo file PDF báo cáo kết quả theo bài tập/trò chơi
 * @param {Object} options
 * @param {{title: string, description?: string, type?: string, category?: string}} options.item
 * @param {{totalStudents: number, submittedCount: number, notSubmittedCount: number, averageScore: number}} options.summary
 * @param {Array<{studentName: string, className?: string, score: number, teacherScore?: number | null, timeSpent?: number}>} options.results
 * @param {string} options.outputDir - thư mục lưu file
 * @returns {Promise<{filePath: string, fileName: string}>}
 */
const generateItemResultReportPdf = async ({ item, summary, results, outputDir }) => {
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	const fileName = `report_item_${Date.now()}.pdf`;
	const filePath = path.join(outputDir, fileName);

	return new Promise((resolve, reject) => {
		const doc = new PDFDocument({ margin: 40 });
		const fontPath = path.join(__dirname, '..', 'fonts', 'DejaVuSans.ttf');
		if (fs.existsSync(fontPath)) {
			doc.font(fontPath);
		}
		const stream = fs.createWriteStream(filePath);

		doc.pipe(stream);

		doc.fontSize(18).text('BÁO CÁO KẾT QUẢ', { align: 'center' });
		doc.moveDown(0.5);
		doc.fontSize(14).text(item.title || 'Không có tiêu đề', { align: 'center' });

		if (item.type || item.category) {
			doc.moveDown(0.3);
			doc.fontSize(11).text(
				[
					item.type ? `Loại: ${item.type}` : null,
					item.category ? `Danh mục: ${item.category}` : null
				].filter(Boolean).join(' • '),
				{ align: 'center' }
			);
		}

		if (item.description) {
			doc.moveDown();
			doc.fontSize(10).text(item.description, { align: 'left' });
		}

		doc.moveDown();
		doc.fontSize(12).text('Tổng quan:', { underline: true });
		doc.moveDown(0.3);
		doc.fontSize(11)
			.text(`- Tổng số học sinh: ${summary.totalStudents}`)
			.text(`- Số học sinh đã nộp: ${summary.submittedCount}`)
			.text(`- Số học sinh chưa nộp: ${summary.notSubmittedCount}`)
			.text(`- Điểm trung bình: ${summary.averageScore}%`);

		doc.moveDown();
		doc.fontSize(12).text('Chi tiết học sinh:', { underline: true });
		doc.moveDown(0.5);

		const headers = ['STT', 'Họ và tên', 'Lớp', 'Điểm', 'Điểm GV', 'Thời gian'];
		const colWidths = [40, 170, 100, 60, 70, 80];
		const startX = doc.x;
		let y = doc.y;

		doc.fontSize(10);
		headers.forEach((h, i) => {
			doc.text(h, startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + 2, y, {
				width: colWidths[i] - 4,
				align: i === 1 ? 'left' : 'center'
			});
		});

		y += 18;
		doc.moveTo(startX, y - 4).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y - 4).stroke();

		const formatTime = (seconds = 0) => {
			const m = Math.floor(seconds / 60);
			const s = seconds % 60;
			return `${m}p${String(s).padStart(2, '0')}s`;
		};

		results.forEach((r, idx) => {
			if (y > doc.page.height - 80) {
				doc.addPage();
				y = doc.y;
			}

			const row = [
				String(idx + 1),
				r.studentName || '',
				r.className || '',
				typeof r.score === 'number' ? `${r.score}%` : '',
				typeof r.teacherScore === 'number' ? `${r.teacherScore}%` : '',
				formatTime(r.timeSpent || 0)
			];

			row.forEach((cell, i) => {
				doc.text(
					cell,
					startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + 2,
					y,
					{
						width: colWidths[i] - 4,
						align: i === 1 ? 'left' : 'center'
					}
				);
			});

			y += 16;
		});

		doc.moveDown();
		doc.fontSize(9).text(`Ngày tạo báo cáo: ${new Date().toLocaleString('vi-VN')}`, {
			align: 'right'
		});

		doc.end();

		stream.on('finish', () => resolve({ filePath, fileName }));
		stream.on('error', reject);
	});
};

/**
 * Tạo file PDF báo cáo theo học sinh (danh sách bài học & trò chơi)
 * @param {Object} options
 * @param {{name: string, className?: string}} options.student
 * @param {Array<{title: string, type: 'baiHoc' | 'troChoi', category?: string, score: number, timeSpent: number, completedAt?: Date}>} options.activities
 * @param {string} options.outputDir
 * @returns {Promise<{filePath: string, fileName: string}>}
 */
const generateStudentReportPdf = async ({ student, activities, outputDir }) => {
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	const fileName = `report_student_${Date.now()}.pdf`;
	const filePath = path.join(outputDir, fileName);

	const total = activities.length;
	const avgScore = total > 0
		? Math.round(activities.reduce((sum, a) => sum + (a.score || 0), 0) / total)
		: 0;

	return new Promise((resolve, reject) => {
		const doc = new PDFDocument({ margin: 40 });
		const fontPath = path.join(__dirname, '..', 'fonts', 'DejaVuSans.ttf');
		if (fs.existsSync(fontPath)) {
			doc.font(fontPath);
		}
		const stream = fs.createWriteStream(filePath);
		doc.pipe(stream);

		doc.fontSize(18).text('BÁO CÁO KẾT QUẢ HỌC TẬP', { align: 'center' });
		doc.moveDown(0.5);
		doc.fontSize(14).text(student.name || '', { align: 'center' });

		if (student.className) {
			doc.moveDown(0.3);
			doc.fontSize(11).text(`Lớp: ${student.className}`, { align: 'center' });
		}

		doc.moveDown();
		doc.fontSize(12).text('Tổng quan:', { underline: true });
		doc.moveDown(0.3);
		doc.fontSize(11)
			.text(`- Tổng số hoạt động: ${total}`)
			.text(`- Điểm trung bình: ${avgScore}%`);

		doc.moveDown();
		doc.fontSize(12).text('Chi tiết bài học & trò chơi:', { underline: true });
		doc.moveDown(0.5);

		const headers = ['STT', 'Tên hoạt động', 'Loại', 'Danh mục', 'Điểm', 'Thời gian', 'Ngày hoàn thành'];
		const colWidths = [30, 170, 60, 80, 50, 70, 100];
		const startX = doc.x;
		let y = doc.y;

		doc.fontSize(9);
		headers.forEach((h, i) => {
			doc.text(h, startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + 2, y, {
				width: colWidths[i] - 4,
				align: i === 1 ? 'left' : 'center'
			});
		});

		y += 16;
		doc.moveTo(startX, y - 4).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y - 4).stroke();
		doc.font('Helvetica');

		const formatTime = (seconds = 0) => {
			const m = Math.floor(seconds / 60);
			const s = seconds % 60;
			return `${m}p${String(s).padStart(2, '0')}s`;
		};

		const formatDate = (d) => {
			try {
				const date = d instanceof Date ? d : new Date(d);
				return date.toLocaleString('vi-VN');
			} catch {
				return '';
			}
		};

		activities.forEach((a, idx) => {
			if (y > doc.page.height - 80) {
				doc.addPage();
				y = doc.y;
			}

			const row = [
				String(idx + 1),
				a.title || '',
				a.type === 'troChoi' ? 'Trò chơi' : 'Bài học',
				a.category || '',
				typeof a.score === 'number' ? `${a.score}%` : '',
				formatTime(a.timeSpent || 0),
				formatDate(a.completedAt)
			];

			row.forEach((cell, i) => {
				doc.text(
					cell,
					startX + colWidths.slice(0, i).reduce((acc, w) => acc + w, 0) + 2,
					y,
					{
						width: colWidths[i] - 4,
						align: i === 1 ? 'left' : 'center'
					}
				);
			});

			y += 14;
		});

		doc.moveDown();
		doc.fontSize(9).text(`Ngày tạo báo cáo: ${new Date().toLocaleString('vi-VN')}`, {
			align: 'right'
		});

		doc.end();

		stream.on('finish', () => resolve({ filePath, fileName }));
		stream.on('error', reject);
	});
};

module.exports = {
	generateItemResultReportPdf,
	generateStudentReportPdf
};


