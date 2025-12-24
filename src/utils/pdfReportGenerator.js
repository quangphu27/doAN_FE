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
		const mainFont = fs.existsSync(fontPath) ? fontPath : null;
		if (mainFont) {
			try {
				doc.registerFont('DejaVu', mainFont);
				doc.registerFont('DejaVu-Bold', mainFont);
				doc.font('DejaVu');
			} catch (err) {
				doc.font(mainFont);
			}
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
			.text(`- Điểm trung bình: ${summary.averageScore}`);

		doc.moveDown();
		doc.fontSize(12).text('Chi tiết học sinh:', { underline: true });
		doc.moveDown(0.5);

		const headers = ['STT', 'Họ và tên', 'Lớp', 'Điểm', 'Thời gian'];
		const colWidths = [40, 180, 120, 120, 80];
		const startX = doc.x;
		let y = doc.y;

		if (mainFont) {
			try { doc.font('DejaVu-Bold'); } catch { doc.font(mainFont); }
		}
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
			if (y > doc.page.height - 100) {
				doc.addPage();
				y = doc.y;
			}

			const rowHeight = 16;
			const rowY = y - 2;

			if (idx % 2 === 0) {
				doc.save();
				doc.rect(startX, rowY, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill('#f7f7f7');
				doc.restore();
			}
			let displayScore;
			const isColoringGame = item.type === 'toMau';
			if (isColoringGame && Object.prototype.hasOwnProperty.call(r, 'teacherScore')) {
				if (r.teacherScore === null || r.teacherScore === undefined) {
					displayScore = 'Chưa chấm điểm';
				} else {
					displayScore = String(r.teacherScore);
				}
			} else if (Object.prototype.hasOwnProperty.call(r, 'teacherScore')) {
				displayScore = r.teacherScore === null ? '' : String(r.teacherScore);
			} else {
				const scoreVal = typeof r.score === 'number' ? r.score : 0;
				displayScore = String(scoreVal);
			}

				const row = [
					String(idx + 1),
					r.studentName || '',
					r.className || '',
					displayScore,
					formatTime(r.timeSpent || 0)
				];

			if (mainFont) { try { doc.font('DejaVu'); } catch { doc.font(mainFont); } }
			row.forEach((cell, i) => {
				doc.fillColor('black').text(
					cell,
					startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + 2,
					y,
					{
						width: colWidths[i] - 4,
						align: i === 1 ? 'left' : 'center',
						ellipsis: false
					}
				);
			});

			y += rowHeight;
		});
		doc.moveDown();
		const now1 = new Date();
		const dateStr1 = `${now1.toLocaleTimeString('vi-VN')} ${now1.toLocaleDateString('vi-VN')}`;
		const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
		doc.fontSize(9).text(`Ngày tạo báo cáo: ${dateStr1}`, doc.page.margins.left, doc.y, { width: pageWidth, align: 'right' });

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
		const mainFont = fs.existsSync(fontPath) ? fontPath : null;
		if (mainFont) {
			try {
				doc.registerFont('DejaVu', mainFont);
				doc.registerFont('DejaVu-Bold', mainFont);
				doc.font('DejaVu');
			} catch (err) {
				doc.font(mainFont);
			}
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
			.text(`- Điểm trung bình: ${avgScore}`);

		doc.moveDown();
		doc.fontSize(12).text('Chi tiết bài học & trò chơi:', { underline: true });
		doc.moveDown(0.5);

		const headers = ['STT', 'Tên hoạt động', 'Loại', 'Điểm', 'Thời gian', 'Ngày hoàn thành'];
		const colWidths = [30, 120, 60, 130, 70, 120];
		const startX = doc.x;
		let y = doc.y;

		if (mainFont) { try { doc.font('DejaVu-Bold'); } catch { doc.font(mainFont); } }
		doc.fontSize(9);
		headers.forEach((h, i) => {
			doc.text(h, startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + 2, y, {
				width: colWidths[i] - 4,
				align: i === 1 ? 'left' : 'center'
			});
		});

		y += 16;
		doc.moveTo(startX, y - 4).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y - 4).stroke();

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

		// Rows with alternating background and score fallback to 0
		activities.forEach((a, idx) => {
			if (y > doc.page.height - 100) {
				doc.addPage();
				y = doc.y;
			}

			const rowHeight = 14;
			const rowY = y - 2;
			if (idx % 2 === 0) {
				doc.save();
				doc.rect(startX, rowY, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill('#f7f7f7');
				doc.restore();
			}

			let displayScore;
			const isColoringGame = a.type === 'troChoi' && a.gameType === 'toMau';
			if (isColoringGame && Object.prototype.hasOwnProperty.call(a, 'teacherScore')) {
				if (a.teacherScore === null || a.teacherScore === undefined) {
					displayScore = 'Chưa chấm điểm';
				} else {
					displayScore = String(a.teacherScore);
				}
			} else {
				const scoreVal = typeof a.score === 'number' ? a.score : 0;
				displayScore = String(scoreVal);
			}

			const row = [
				String(idx + 1),
				a.title || '',
				a.type === 'troChoi' ? 'Trò chơi' : 'Bài học',
				displayScore,
				formatTime(a.timeSpent || 0),
				a.completedAt ? formatDate(a.completedAt) : ''
			];

			if (mainFont) { try { doc.font('DejaVu'); } catch { doc.font(mainFont); } }
			row.forEach((cell, i) => {
				doc.fillColor('black').text(
					cell,
					startX + colWidths.slice(0, i).reduce((acc, w) => acc + w, 0) + 2,
					y,
					{
						width: colWidths[i] - 4,
						align: i === 1 ? 'left' : 'center',
						ellipsis: false
					}
				);
			});

			y += rowHeight;
		});

		doc.moveDown();
		const now2 = new Date();
		const dateStr2 = `${now2.toLocaleTimeString('vi-VN')} ${now2.toLocaleDateString('vi-VN')}`;
		const pageWidth2 = doc.page.width - doc.page.margins.left - doc.page.margins.right;
		doc.fontSize(9).text(`Ngày tạo báo cáo: ${dateStr2}`, doc.page.margins.left, doc.y, { width: pageWidth2, align: 'right' });

		doc.end();

		stream.on('finish', () => resolve({ filePath, fileName }));
		stream.on('error', reject);
	});
};

module.exports = {
	generateItemResultReportPdf,
	generateStudentReportPdf
};


