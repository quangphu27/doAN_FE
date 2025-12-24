const Joi = require('joi');
const Game = require('../models/TroChoi');
const Child = require('../models/TreEm');
const User = require('../models/NguoiDung');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { generateItemResultReportPdf } = require('../utils/pdfReportGenerator');
const { sendReportEmail } = require('../services/emailService');

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		const uploadPath = 'uploads/games';
		if (!fs.existsSync(uploadPath)) {
			fs.mkdirSync(uploadPath, { recursive: true });
		}
		cb(null, uploadPath);
	},
	filename: (req, file, cb) => {
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
		cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
	}
});

const upload = multer({ 
	storage: storage,
	limits: { fileSize: 50 * 1024 * 1024 },
	fileFilter: (req, file, cb) => {
		if (file.mimetype.startsWith('image/') || 
		    file.mimetype.startsWith('video/') ||
		    file.mimetype === 'image/gif') {
			cb(null, true);
		} else {
			cb(new Error('Only image, video, and gif files are allowed'), false);
		}
	}
});

const listGames = async (req, res, next) => {
	try {
		const { page = 1, limit = 20, type: loai, category: danhMuc, level: capDo, lop } = req.query;
		const filter = { trangThai: true };
		if (loai) {
			if (loai === 'guess_action') {
				filter.loai = { $in: ['guess_action', 'guessing'] };
			} else {
				filter.loai = loai;
			}
		}
		if (danhMuc) filter.danhMuc = danhMuc;
		if (capDo) filter.capDo = capDo;
		// Admin xem tất cả, giáo viên xem theo lớp
		if (req.user && req.user.vaiTro === 'giaoVien' && !lop) {
			// Giáo viên chỉ xem game của lớp mình
			const Class = require('../models/Lop');
			const classes = await Class.find({ giaoVien: req.user.id || req.user._id }).select('_id');
			const classIds = classes.map(c => c._id);
			filter.lop = { $in: classIds };
		} else if (lop) {
			filter.lop = lop;
		}

		if (req.user && req.user.vaiTro === 'hocSinh') {
			const Class = require('../models/Lop');

			const child = await Child.findById(req.user.id || req.user._id).select('_id');

			if (!child) {
				return res.json({
					success: true,
					data: {
						games: [],
						pagination: {
							total: 0,
							page: parseInt(page),
							limit: parseInt(limit),
							pages: 0
						}
					}
				});
			}

			// Lấy các lớp có học sinh này
			const classes = await Class.find({ hocSinh: child._id }).select('troChoi');
			const gameIds = Array.from(new Set(
				classes.flatMap(c => (c.troChoi || []).map(id => id.toString()))
			));

			// Nếu lớp không có trò chơi → trả về rỗng
			if (gameIds.length === 0) {
				return res.json({
					success: true,
					data: {
						games: [],
						pagination: {
							total: 0,
							page: parseInt(page),
							limit: parseInt(limit),
							pages: 0
						}
					}
				});
			}

			filter._id = { $in: gameIds };
		}
		// Admin xem tất cả (không filter theo lớp hoặc học sinh)

		const games = await Game.find(filter)
			.populate('lop', 'tenLop maLop')
			.populate('nguoiTao', 'hoTen email')
			.sort({ createdAt: -1 })
			.limit(parseInt(limit))
			.skip((parseInt(page) - 1) * parseInt(limit));

		const total = await Game.countDocuments(filter);

		res.json({
			success: true,
			data: {
				games,
				pagination: {
					total,
					page: parseInt(page),
					limit: parseInt(limit),
					pages: Math.ceil(total / parseInt(limit))
				}
			}
		});
	} catch (e) {
		next(e);
	}
};

const getGameById = async (req, res, next) => {
	try {
		const game = await Game.findById(req.params.id);
		if (!game) return res.status(404).json({ success: false, message: 'Game not found' });
		res.json({ success: true, data: game });
	} catch (e) {
		next(e);
	}
};

const createGame = async (req, res, next) => {
	try {
		
		const schema = Joi.object({
			ma: Joi.string().required(),
			loai: Joi.string().valid('toMau', 'xepHinh', 'ghepDoi', 'doan').required(),
			tieuDe: Joi.string().required(),
			moTa: Joi.string().optional(),
			danhMuc: Joi.string().valid('chuCai', 'so', 'mauSac', 'hanhDong').required(),
			capDo: Joi.string().valid('coBan', 'trungBinh', 'nangCao').optional(),
			duLieu: Joi.object({
				huongDan: Joi.string().optional(),
				vatPham: Joi.array().items(Joi.object({
					id: Joi.string().optional(),
					anhDaiDien: Joi.string().optional(),
					vanBan: Joi.string().optional(),
					amThanh: Joi.string().optional(),
					viTri: Joi.object({
						x: Joi.number().optional(),
						y: Joi.number().optional()
					}).optional()
				})).optional(),
				diemSo: Joi.object({
					diemMoiVatPham: Joi.number().optional(),
					diemThoiGian: Joi.number().optional(),
					diemToiDa: Joi.number().optional()
				}).optional(),
				manhXepHinh: Joi.array().items(Joi.object({
					id: Joi.string().optional(),
					anhDaiDien: Joi.string().optional(),
					viTriDung: Joi.object({
						x: Joi.number().optional(),
						y: Joi.number().optional()
					}).optional()
				})).optional(),
				cauHoi: Joi.array().items(Joi.object({
					id: Joi.string().optional(),
					anhDaiDien: Joi.string().optional(),
					phuongTien: Joi.string().optional(),
					loaiPhuongTien: Joi.string().valid('anh', 'video', 'gif').optional(),
					cauHoi: Joi.string().optional(),
					phuongAn: Joi.array().items(Joi.string()).optional(),
					dapAnDung: Joi.string().optional(),
					giaiThich: Joi.string().optional()
				})).optional(),
				anhGoc: Joi.string().optional(),
				manh: Joi.array().optional(),
				hang: Joi.number().optional(),
				cot: Joi.number().optional(),
				duLieuToMau: Joi.object({
					anhVien: Joi.string().optional(),
					mauGợiY: Joi.array().items(Joi.string()).optional(),
					vungMau: Joi.array().items(Joi.object({
						id: Joi.string().optional(),
						duongDan: Joi.string().optional(),
						mauGợiY: Joi.string().optional()
					})).optional()
				}).optional(),
				capGhepDoi: Joi.array().items(Joi.object({
					id: Joi.string().optional(),
					vanBan: Joi.string().optional(),
					anhDaiDien: Joi.string().optional(),
					amThanh: Joi.string().optional(),
					viTri: Joi.object({
						x: Joi.number().optional(),
						y: Joi.number().optional()
					}).optional()
				})).optional()
			}).optional(),
			anhDaiDien: Joi.string().optional(),
			thoiGianUocTinh: Joi.number().optional(),
			doTuoi: Joi.object({
				toiThieu: Joi.number().optional(),
				toiDa: Joi.number().optional()
			}).optional(),
			lop: Joi.array().items(Joi.string()).optional()
		}).unknown(true);

		const gameData = await schema.validateAsync(req.body);
		
		// Thêm nguoiTao nếu có user đăng nhập
		if (req.user) {
			gameData.nguoiTao = req.user.id || req.user._id;
		}
		
		const game = await Game.create(gameData);
		
		// Nếu có lớp, thêm game vào lớp
		if (gameData.lop && gameData.lop.length > 0) {
			const Class = require('../models/Lop');
			for (const classId of gameData.lop) {
				await Class.findByIdAndUpdate(classId, { $addToSet: { troChoi: game._id } });
			}
		}
		
		res.status(201).json({ success: true, data: game });
	} catch (e) {
		next(e);
	}
};

const updateGame = async (req, res, next) => {
	try {
		const schema = Joi.object({
			tieuDe: Joi.string().optional(),
			moTa: Joi.string().optional(),
			danhMuc: Joi.string().valid('chuCai', 'so', 'mauSac', 'hanhDong').optional(),
			capDo: Joi.string().valid('coBan', 'trungBinh', 'nangCao').optional(),
			duLieu: Joi.object().optional(),
			anhDaiDien: Joi.string().optional(),
			thoiGianUocTinh: Joi.number().optional(),
			doTuoi: Joi.object({
				toiThieu: Joi.number().optional(),
				toiDa: Joi.number().optional()
			}).optional(),
			isActive: Joi.boolean().optional()
		});

		const updateData = await schema.validateAsync(req.body);
		const game = await Game.findByIdAndUpdate(
			req.params.id,
			updateData,
			{ new: true }
		);

		if (!game) {
			return res.status(404).json({ success: false, message: 'Game not found' });
		}

		res.json({ success: true, data: game });
	} catch (e) {
		next(e);
	}
};

const deleteGame = async (req, res, next) => {
	try {
		const game = await Game.findById(req.params.id);
		if (!game) {
			return res.status(404).json({ success: false, message: 'Game not found' });
		}
		
		if (req.user.vaiTro === 'giaoVien') {
			const gameCreatorId = game.nguoiTao?.toString() || game.nguoiTao;
			const userId = req.user.id?.toString() || req.user._id?.toString() || req.user.id;
			if (gameCreatorId !== userId) {
				return res.status(403).json({ 
					success: false, 
					message: 'Bạn chỉ có thể xóa game do chính mình tạo ra' 
				});
			}
		}
		
		await Game.findByIdAndDelete(req.params.id);
		res.json({ success: true, message: 'Game deleted successfully' });
	} catch (e) {
		next(e);
	}
};

const uploadPuzzleImage = async (req, res, next) => {
	try {
		if (!req.file) {
			return res.status(400).json({ success: false, message: 'No image uploaded' });
		}

		const { rows = 3, cols = 3 } = req.body;
		const imagePath = req.file.path;
		const pieces = [];

		const image = sharp(imagePath);
		const metadata = await image.metadata();
		
		if (!metadata.width || !metadata.height) {
			return res.status(400).json({ success: false, message: 'Cannot read image dimensions' });
		}
		
		const pieceWidth = Math.floor(metadata.width / cols);
		const pieceHeight = Math.floor(metadata.height / rows);
		
		// Validate piece dimensions
		if (pieceWidth <= 0 || pieceHeight <= 0) {
			return res.status(400).json({ 
				success: false, 
				message: `Image too small for ${rows}x${cols} puzzle. Minimum size: ${cols * 100}x${rows * 100} pixels` 
			});
		}
		
		// Ensure extract area doesn't exceed image bounds
		if (pieceWidth * cols > metadata.width || pieceHeight * rows > metadata.height) {
			return res.status(400).json({ 
				success: false, 
				message: 'Puzzle dimensions exceed image size' 
			});
		}

		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				const pieceId = `piece_${row}_${col}`;
				const piecePath = `uploads/games/pieces/${pieceId}_${Date.now()}.jpg`;
				
				const piecesDir = 'uploads/games/pieces';
				if (!fs.existsSync(piecesDir)) {
					fs.mkdirSync(piecesDir, { recursive: true });
				}

				try {
					const left = col * pieceWidth;
					const top = row * pieceHeight;
					
					// Validate extract area bounds
					if (left + pieceWidth > metadata.width || top + pieceHeight > metadata.height) {
						throw new Error(`Extract area exceeds image bounds: left=${left}, top=${top}, width=${pieceWidth}, height=${pieceHeight}, image=${metadata.width}x${metadata.height}`);
					}

					await image
						.clone()
						.extract({
							left: left,
							top: top,
							width: pieceWidth,
							height: pieceHeight
						})
						.jpeg()
						.toFile(piecePath);

					pieces.push({
						id: pieceId,
						imageUrl: piecePath,
						correctPosition: {
							x: left,
							y: top
						}
					});
				} catch (extractError) {
					console.error(`Error extracting piece ${pieceId}:`, extractError);
					throw new Error(`Failed to extract puzzle piece ${pieceId}: ${extractError.message}`);
				}
			}
		}

		res.json({
			success: true,
			data: {
				originalImage: req.file.filename,
				pieces: pieces.map(piece => ({
					...piece,
					imageUrl: piece.imageUrl.split('/').pop()
				})),
				rows: parseInt(rows),
				cols: parseInt(cols)
			}
		});
	} catch (e) {
		next(e);
	}
};

const uploadGuessImage = async (req, res, next) => {
	try {
		if (!req.file) {
			return res.status(400).json({ success: false, message: 'No image uploaded' });
		}

		res.json({
			success: true,
			data: {
				imageUrl: req.file.path,
				filename: req.file.filename
			}
		});
	} catch (e) {
		next(e);
	}
};
// câp nhật kết quả gmae 
const playGame = async (req, res, next) => {
	try {
		const schema = Joi.object({
			childId: Joi.string().required(),
			gameKey: Joi.string().required(),
			score: Joi.number().required(),
			timeSpent: Joi.number().optional(),
			answers: Joi.array().items(Joi.object({
				questionId: Joi.string().required(),
				answer: Joi.string().required(),
				isCorrect: Joi.boolean().required()
			})).optional()
		});

		const { childId, gameKey, score, timeSpent, answers } = await schema.validateAsync(req.body);
		// Kiểm tra quyền: nếu là phụ huynh thì phải là phụ huynh của trẻ, nếu là học sinh thì childId phải = user.id
		let child;
		if (req.user.vaiTro === 'hocSinh') {
			child = await Child.findById(req.user.id || req.user._id);
		} else {
			child = await Child.findOne({ _id: childId, phuHuynh: req.user.id });
		}
		if (!child) return res.status(404).json({ success: false, message: 'Child not found' });

		const game = await Game.findOne({ key: gameKey });
		if (!game) return res.status(404).json({ success: false, message: 'Game not found' });

		child.progress.games.push({
			gameKey,
			score,
			timeSpent: timeSpent || 0,
			answers: answers || [],
			completedAt: new Date()
		});

		await child.save();

		const achievements = [];
		if (score >= 90) achievements.push('excellent');
		if (score >= 80) achievements.push('good');
		if (score >= 70) achievements.push('pass');

		res.json({
			success: true,
			data: {
				score,
				achievements,
				message: score >= 80 ? 'Tuyệt vời!' : score >= 60 ? 'Tốt lắm!' : 'Cố gắng thêm nhé!'
			}
		});
	} catch (e) {
		next(e);
	}
};

const createColoringGame = async (req, res, next) => {
	try {
		
		const schema = Joi.object({
			title: Joi.string().required(),
			description: Joi.string().optional(),
			category: Joi.string().valid('letter', 'number', 'color', 'action').optional(),
			level: Joi.string().valid('beginner', 'intermediate', 'advanced').optional(),
			suggestedColors: Joi.array().items(Joi.string().pattern(/^#[0-9A-F]{6}$/i)).optional(),
			estimatedTime: Joi.number().optional()
		});

		if (req.body.suggestedColors && typeof req.body.suggestedColors === 'string') {
			try {
				req.body.suggestedColors = JSON.parse(req.body.suggestedColors);
			} catch (e) {
			}
		}
		
		const gameData = await schema.validateAsync(req.body);
		
		if (!req.file) {
			return res.status(400).json({ success: false, message: 'Outline image is required' });
		}

		const key = `coloring_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		
		const imageUrl = req.file.filename;
		
		const gameDataToCreate = {
			key,
			type: 'coloring',
			title: gameData.title,
			description: gameData.description,
			level: gameData.level || 'beginner',
			imageUrl: imageUrl,
			estimatedTime: gameData.estimatedTime || 10,
			data: {
				coloringData: {
					outlineImage: imageUrl,
					suggestedColors: gameData.suggestedColors || ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'],
					colorAreas: []
				}
			}
		};
		
		if (gameData.category) {
			gameDataToCreate.category = gameData.category;
		}
		
		const game = await Game.create(gameDataToCreate);

		res.status(201).json({ success: true, data: game });
	} catch (e) {
		next(e);
	}
};

const createPuzzleGame = async (req, res, next) => {
	try {
		
		const schema = Joi.object({
			title: Joi.string().required(),
			description: Joi.string().optional(),
			category: Joi.string().valid('letter', 'number', 'color', 'action').optional(),
			level: Joi.string().valid('beginner', 'intermediate', 'advanced').optional(),
			rows: Joi.number().min(2).max(5).required(),
			cols: Joi.number().min(2).max(5).required(),
			estimatedTime: Joi.number().optional()
		});

		const gameData = await schema.validateAsync(req.body);
		
		if (!req.file) {
			return res.status(400).json({ success: false, message: 'Original image is required' });
		}

		const key = `puzzle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		
		const imageUrl = req.file.filename;
		
		const gameDataToCreate = {
			key,
			type: 'puzzle',
			title: gameData.title,
			description: gameData.description,
			level: gameData.level || 'beginner',
			imageUrl: imageUrl,
			estimatedTime: gameData.estimatedTime || 15,
			data: {
				originalImage: imageUrl,
				rows: gameData.rows,
				cols: gameData.cols,
				puzzlePieces: []
			}
		};
		
		if (gameData.category) {
			gameDataToCreate.category = gameData.category;
		}
		
		const game = await Game.create(gameDataToCreate);

		res.status(201).json({ success: true, data: game });
	} catch (e) {
		next(e);
	}
};

const createMatchingGame = async (req, res, next) => {
	try {
		
		const schema = Joi.object({
			title: Joi.string().required(),
			description: Joi.string().optional(),
			category: Joi.string().valid('letter', 'number', 'color', 'action').optional(),
			level: Joi.string().valid('beginner', 'intermediate', 'advanced').optional(),
			pairs: Joi.array().items(Joi.object({
				text: Joi.string().required(),
				imageUrl: Joi.string().optional()
			})).min(2).required(),
			estimatedTime: Joi.number().optional()
		});

		const gameData = await schema.validateAsync(req.body);
		
		const key = `matching_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		
		const processedPairs = await Promise.all(
			gameData.pairs.map(async (pair, index) => {
				const pairData = {
					id: `pair_${index}`,
					text: pair.text,
					imageUrl: pair.imageUrl || null,
					position: { x: 0, y: 0 }
				};
				return pairData;
			})
		);
		
		const gameDataToCreate = {
			key,
			type: 'matching',
			title: gameData.title,
			description: gameData.description,
			level: gameData.level || 'beginner',
			imageUrl: processedPairs[0]?.imageUrl || null,
			estimatedTime: gameData.estimatedTime || 10,
			data: {
				matchingPairs: processedPairs
			}
		};
		
		if (gameData.category) {
			gameDataToCreate.category = gameData.category;
		}
		
		const game = await Game.create(gameDataToCreate);

		res.status(201).json({ success: true, data: game });
	} catch (e) {
		next(e);
	}
};

const createGuessingGame = async (req, res, next) => {
	try {
		let questionsData = [];
		if (req.body.questions) {
			try {
				questionsData = typeof req.body.questions === 'string' 
					? JSON.parse(req.body.questions) 
					: req.body.questions;
				
				questionsData = questionsData.map(q => ({
					...q,
					explanation: q.explanation && q.explanation.trim() ? q.explanation : undefined
				}));
			} catch (e) {
				return res.status(400).json({ 
					success: false, 
					message: 'Invalid questions format: ' + e.message 
				});
			}
		}

		const schema = Joi.object({
			title: Joi.string().required(),
			description: Joi.string().optional().allow('', null),
			category: Joi.string().valid('letter', 'number', 'color', 'action').optional(),
			level: Joi.string().valid('beginner', 'intermediate', 'advanced').optional(),
			questions: Joi.array().items(Joi.object({
				options: Joi.array().items(Joi.string().min(1)).length(4).required(),
				correctAnswer: Joi.string().min(1).required(),
				explanation: Joi.string().optional().allow('', null)
			})).min(1).required(),
			estimatedTime: Joi.number().optional()
		});

		const bodyData = { ...req.body };
		if (bodyData.estimatedTime) {
			bodyData.estimatedTime = parseFloat(bodyData.estimatedTime);
		}

		const gameData = await schema.validateAsync({
			...bodyData,
			questions: questionsData
		});
		
		if (!req.files || req.files.length === 0) {
			return res.status(400).json({ success: false, message: 'Ít nhất một file media (image/video/gif) là bắt buộc' });
		}

		if (req.files.length !== gameData.questions.length) {
			return res.status(400).json({ 
				success: false, 
				message: `Số lượng file (${req.files.length}) phải khớp với số lượng câu hỏi (${gameData.questions.length})` 
			});
		}

		const key = `guessing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		
		const processedQuestions = await Promise.all(
			gameData.questions.map(async (question, index) => {
				const file = req.files[index];
				let mediaType = 'image';
				
				if (file.mimetype.startsWith('video/')) {
					mediaType = 'video';
				} else if (file.mimetype === 'image/gif') {
					mediaType = 'gif';
				}
				
				return {
					id: `question_${index}`,
					mediaUrl: file.filename,
					mediaType: mediaType,
					imageUrl: mediaType === 'image' ? file.filename : null,
					options: question.options,
					correctAnswer: question.correctAnswer,
					explanation: question.explanation || ''
				};
			})
		);
		
		const gameDataToCreate = {
			key,
			type: 'guessing',
			title: gameData.title,
			description: gameData.description,
			level: gameData.level || 'beginner',
			imageUrl: processedQuestions[0]?.mediaUrl || null,
			estimatedTime: gameData.estimatedTime || 10,
			data: {
				questions: processedQuestions
			}
		};
		
		if (gameData.category) {
			gameDataToCreate.category = gameData.category;
		}
		
		const game = await Game.create(gameDataToCreate);

		res.status(201).json({ success: true, data: game });
	} catch (e) {
		next(e);
	}
};

const saveGameResult = async (req, res, next) => {
	try {
		const logBody = { ...req.body };
		if (logBody.resultImageBase64 && logBody.resultImageBase64.length > 100) {
			logBody.resultImageBase64 = logBody.resultImageBase64.substring(0, 100) + '... (truncated)';
		}
		console.log('[saveGameResult] Request body:', JSON.stringify(logBody, null, 2));
		
		const { resultData, ...bodyWithoutResultData } = req.body;
		
		const schema = Joi.object({
			gameId: Joi.string().required(),
			userId: Joi.string().required(),
			score: Joi.number().min(0).max(100).required(),
			timeSpent: Joi.number().min(0).required(),
			gameType: Joi.string().valid('coloring', 'puzzle', 'matching', 'guessing').required()
		});

		const validatedData = await schema.validateAsync(bodyWithoutResultData, { allowUnknown: true, stripUnknown: false });
		
		const resultData_final = {
			...validatedData,
			resultData: resultData
		};

		let savedResultImage = null;
		const resultDir = 'uploads/tomau/ketqua';
		
		if (!fs.existsSync(resultDir)) {
			fs.mkdirSync(resultDir, { recursive: true });
		}
		
		if (req.body.resultImageBase64) {
			try {
				const base64String = req.body.resultImageBase64;
				const matches = base64String.match(/^data:(.+);base64,(.+)$/);
				const ext = matches ? matches[1].split('/')[1] || 'png' : 'png';
				const data = matches ? matches[2] : base64String;
				const buffer = Buffer.from(data, 'base64');
				const filename = `ketqua_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
				const filepath = path.join(resultDir, filename);
				fs.writeFileSync(filepath, buffer);
				savedResultImage = filepath;
				console.log('[saveGameResult] Đã lưu ảnh tô màu từ base64:', {
					filepath: filepath,
					filename: filename,
					size: buffer.length
				});
			} catch (imgErr) {
				console.error('[saveGameResult] Lỗi khi lưu ảnh từ base64:', imgErr);
			}
		}
		else if (req.body.resultImageUrl || req.body.imageUrl) {
			try {
				const imageUrl = req.body.resultImageUrl || req.body.imageUrl;
				
				if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('uploads/')) {
					const localPath = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
					const fullPath = path.join(__dirname, '..', '..', localPath);
					
					if (fs.existsSync(fullPath)) {
						const ext = path.extname(fullPath) || '.png';
						const filename = `ketqua_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;
						const destPath = path.join(resultDir, filename);
						
						fs.copyFileSync(fullPath, destPath);
						savedResultImage = destPath;
						
						console.log('[saveGameResult] Đã copy ảnh tô màu:', {
							source: fullPath,
							destination: destPath,
							filename: filename
						});
					} else {
						console.warn('[saveGameResult] File không tồn tại:', fullPath);
						savedResultImage = localPath;
					}
				}
				else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
					savedResultImage = imageUrl;
					console.log('[saveGameResult] Lưu URL ảnh:', imageUrl);
				}
				else {
					savedResultImage = imageUrl;
					console.log('[saveGameResult] Lưu đường dẫn ảnh:', imageUrl);
				}
			} catch (imgErr) {
				console.error('[saveGameResult] Lỗi khi xử lý URL ảnh:', imgErr);
			}
		}
		
		if (!savedResultImage) {
			console.log('[saveGameResult] Không có ảnh trong request body');
		}
		
		const Progress = require('../models/TienDo');
		const Game = require('../models/TroChoi');
		const Child = require('../models/TreEm');
		const game = await Game.findById(resultData_final.gameId);

		if (!game) {
			return res.status(404).json({
				success: false,
				message: 'Không tìm thấy trò chơi'
			});
		}

		let childId = resultData_final.userId;
		if (req.user.vaiTro === 'hocSinh') {
			const childRecord = await Child.findById(req.user.id || req.user._id);
			if (!childRecord) {
				return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ học sinh' });
			}
			childId = childRecord._id.toString();
		}

		const rawAnswers = resultData_final.resultData?.answers || [];
		
		const normalizedAnswers = rawAnswers.map((answer, index) => {
			let exerciseId = answer.exerciseId || answer.questionId || answer.id;
			
			if (!exerciseId || exerciseId.trim() === '') {
				exerciseId = `question_${index}`;
			}
			
			exerciseId = String(exerciseId).trim() || `question_${index}`;
			
			const normalized = {
				exerciseId: exerciseId,
				answer: String(answer.answer || '').trim(),
				isCorrect: Boolean(answer.isCorrect)
			};
			
			return normalized;
		});
		
		const invalidAnswers = normalizedAnswers.filter(a => !a.exerciseId || a.exerciseId.trim() === '');
		if (invalidAnswers.length > 0) {
			return res.status(400).json({
				success: false,
				message: 'Một số câu trả lời không hợp lệ: thiếu exerciseId'
			});
		}

		const progressData = {
			treEm: childId,
			troChoi: resultData_final.gameId,
			loai: 'troChoi',
			trangThai: 'hoanThanh',
			diemSo: resultData_final.score,
			thoiGianDaDung: resultData_final.timeSpent,
			ngayHoanThanh: new Date(),
			cauTraLoi: normalizedAnswers.map(a => ({
				idBaiTap: a.exerciseId,
				cauTraLoi: a.answer,
				dung: a.isCorrect
			})),
			soLanThu: 1,
			trangThaiChamDiem: 'chuaCham',
			diemGiaoVien: null
		};

		if (req.file) {
			const resultDir = 'uploads/tomau/ketqua';
			if (!fs.existsSync(resultDir)) {
				fs.mkdirSync(resultDir, { recursive: true });
			}
			const ext = path.extname(req.file.originalname) || path.extname(req.file.filename) || '.png';
			const filename = `ketqua_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;
			const destPath = path.join(resultDir, filename);
			fs.copyFileSync(req.file.path, destPath);
			progressData.tepKetQua = destPath;
			console.log('[saveGameResult] Đã lưu ảnh từ file upload:', destPath);
		} else if (savedResultImage) {
			progressData.tepKetQua = savedResultImage;
			console.log('[saveGameResult] Đã lưu ảnh:', savedResultImage);
		} else {
			console.log('[saveGameResult] Cảnh báo: Không có ảnh kết quả được lưu');
		}
		if (resultData_final.resultData) {
			progressData.duLieuKetQua = resultData_final.resultData;
		}

		const existingProgress = await Progress.findOne({
			treEm: childId,
			troChoi: resultData_final.gameId,
			loai: 'troChoi'
		});
		
		if (existingProgress) {
			return res.status(400).json({
				success: false,
				message: 'Học sinh đã nộp kết quả, chỉ được làm 1 lần'
			});
		}

		console.log('[saveGameResult] Lưu progress với dữ liệu:', {
			childId: childId,
			gameId: resultData_final.gameId,
			gameType: resultData_final.gameType,
			hasResultImage: !!progressData.tepKetQua,
			resultImagePath: progressData.tepKetQua || 'null',
			score: progressData.diemSo,
			gradingStatus: progressData.trangThaiChamDiem
		});

		const progress = new Progress(progressData);
		await progress.save();
		
		console.log('[saveGameResult] Đã lưu progress thành công:', {
			progressId: progress._id.toString(),
			tepKetQua: progress.tepKetQua || 'null',
			timestamp: new Date().toISOString()
		});
		
		res.json({
			success: true,
			data: {
				message: 'Kết quả đã được lưu thành công!',
				score: resultData_final.score,
				achievements: [],
				progressId: progress._id,
				resultImage: progress.tepKetQua || null
			}
		});
	} catch (e) {
		next(e);
	}
};

const getGameResults = async (req, res, next) => {
	try {
		const { gameId } = req.params;
		const Class = require('../models/Lop');
		const Progress = require('../models/TienDo');

		console.log('[getGameResults] API được gọi:', {
			gameId,
			userRole: req.user?.vaiTro || 'unknown',
			userId: (req.user?.id || req.user?._id || '').toString(),
			timestamp: new Date().toISOString()
		});

		const game = await Game.findById(gameId).populate('lop', 'tenLop maLop giaoVien hocSinh');
		if (!game) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy trò chơi' });
		}

		console.log('[getGameResults] Game tìm thấy:', {
			gameId: game._id.toString(),
			gameTitle: game.tieuDe || game.title || '',
			gameType: game.loai || game.type || ''
		});

		if (req.user.vaiTro === 'giaoVien') {
			const teacherClasses = await Class.find({ giaoVien: req.user.id || req.user._id });
			const teacherClassIds = teacherClasses.map(c => c._id.toString());
			const gameClassIds = (game.lop || []).map(c => c._id ? c._id.toString() : c.toString());
			const hasAccess = gameClassIds.some(id => teacherClassIds.includes(id));
			if (!hasAccess && game.nguoiTao?.toString() !== (req.user.id || req.user._id)?.toString()) {
				return res.status(403).json({ success: false, message: 'Bạn không có quyền xem kết quả trò chơi này' });
			}
		}

		const classIds = (game.lop || []).map(c => c._id || c);
		const allStudents = [];

		for (const classId of classIds) {
			const classData = await Class.findById(classId).populate('hocSinh', 'hoTen ngaySinh gioiTinh anhDaiDien');
			if (classData && classData.hocSinh && classData.hocSinh.length > 0) {
				allStudents.push(...classData.hocSinh.map(student => ({
					studentId: student._id,
					studentName: student.hoTen,
					studentAvatar: student.anhDaiDien,
					classId: classId,
					className: classData.tenLop
				})));
			}
		}

		const studentIds = allStudents.map(s => s.studentId);
		const submittedProgress = await Progress.find({
			troChoi: gameId,
			treEm: { $in: studentIds },
			trangThai: 'hoanThanh',
			loai: 'troChoi'
		}).populate('treEm', 'hoTen ngaySinh gioiTinh anhDaiDien');

		const submittedStudentIds = new Set(submittedProgress.map(p => p.treEm._id.toString()));

		const questionMap = new Map();
		let questionCounter = 1;

		const addQuestionToMap = (id, text, correct) => {
			if (!id) return;
			const key = id.toString();
			const label = `Câu ${questionCounter}`;
			questionMap.set(key, {
				label,
				text: text || label,
				correctAnswer: correct
			});
			questionCounter += 1;
		};

		if (game.duLieu && Array.isArray(game.duLieu.cauHoi)) {
			game.duLieu.cauHoi.forEach(q => addQuestionToMap(q.id, q.cauHoi, q.dapAnDung));
		}

		if (game.data && Array.isArray(game.data.questions)) {
			game.data.questions.forEach(q => addQuestionToMap(q.id || q._id, q.question || q.cauHoi, q.correctAnswer || q.dapAnDung));
		}

		const isColoringGame = game.loai === 'toMau' || game.type === 'coloring';

		const getImageUrl = (filePath) => {
			if (!filePath) return null;
			if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
				return filePath;
			}
			if (filePath.startsWith('uploads/')) {
				return '/' + filePath.replace(/\\/g, '/');
			}
			if (filePath.startsWith('/')) {
				return filePath.replace(/\\/g, '/');
			}
			return '/uploads/' + filePath.replace(/\\/g, '/');
		};

		const submittedStudents = allStudents
			.filter(s => submittedStudentIds.has(s.studentId.toString()))
			.map(student => {
				const progress = submittedProgress.find(p => p.treEm._id.toString() === student.studentId.toString());

				if (isColoringGame && progress && progress.tepKetQua) {
					const logData = {
						time: new Date().toISOString(),
						gameId: game._id.toString(),
						gameTitle: game.tieuDe || game.title || '',
						gameType: game.loai || game.type || '',
						studentId: student.studentId.toString(),
						studentName: student.studentName || '',
						progressId: progress._id.toString(),
						resultImagePath: progress.tepKetQua,
						resultImageUrl: getImageUrl(progress.tepKetQua),
						hasImage: !!progress.tepKetQua
					};

					if (req.user && req.user.vaiTro === 'giaoVien') {
						logData.teacherId = (req.user.id || req.user._id || '').toString();
						logData.teacherName = req.user.hoTen || req.user.name || '';
						console.log('[ColoringViewLog] Giáo viên xem bài tô màu:', JSON.stringify(logData, null, 2));
					} else {
						console.log('[ColoringViewLog] Xem bài tô màu (không phải giáo viên):', JSON.stringify(logData, null, 2));
					}
				}

				const resultImageUrl = progress && progress.tepKetQua ? getImageUrl(progress.tepKetQua) : null;

				return {
					studentId: student.studentId,
					studentName: student.studentName,
					studentAvatar: student.studentAvatar,
					classId: student.classId,
					className: student.className,
					score: progress.diemSo || 0,
					progressId: progress._id,
					teacherScore: typeof progress.diemGiaoVien === 'number' ? progress.diemGiaoVien : null,
					gradingStatus: progress.trangThaiChamDiem || 'chuaCham',
					timeSpent: progress.thoiGianDaDung || 0,
					completedAt: progress.ngayHoanThanh || progress.updatedAt,
					attempts: progress.soLanThu || 1,
					resultImage: resultImageUrl,
					resultImagePath: progress.tepKetQua || null,
					answers: (progress.cauTraLoi || []).map((answer, idx) => {
						const qInfo = questionMap.get(answer.idBaiTap);
						const fallbackLabel = `Câu ${idx + 1}`;
						return {
							exerciseId: answer.idBaiTap,
							displayId: qInfo?.label || fallbackLabel,
							questionLabel: qInfo?.label || fallbackLabel,
							questionText: qInfo?.text || '',
							correctAnswer: qInfo?.correctAnswer || '',
							answer: answer.cauTraLoi,
							isCorrect: answer.dung
						};
					})
				};
			});

		const notSubmittedStudents = allStudents.filter(s => !submittedStudentIds.has(s.studentId.toString()));

		res.json({
			success: true,
			data: {
				game: {
					id: game._id,
					title: game.tieuDe,
					description: game.moTa,
					category: game.danhMuc,
					type: game.loai,
					classes: game.lop || []
				},
				submittedStudents,
				notSubmittedStudents,
				summary: {
					totalStudents: allStudents.length,
					submittedCount: submittedStudents.length,
					notSubmittedCount: notSubmittedStudents.length,
					averageScore: submittedStudents.length > 0
						? Math.round(submittedStudents.reduce((sum, s) => sum + s.score, 0) / submittedStudents.length)
						: 0
				}
			}
		});
	} catch (e) {
		next(e);
	}
};

const exportGameResultsReport = async (req, res, next) => {
	try {
		const { gameId } = req.params;
		const Progress = require('../models/TienDo');
		const Class = require('../models/Lop');

		if (!req.user || req.user.vaiTro !== 'giaoVien') {
			return res.status(403).json({
				success: false,
				message: 'Chỉ giáo viên mới được xuất báo cáo kết quả trò chơi'
			});
		}

		const game = await Game.findById(gameId).populate('lop', 'tenLop maLop giaoVien hocSinh');
		if (!game) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy trò chơi' });
		}

		const teacherClasses = await Class.find({ giaoVien: req.user.id || req.user._id }).select('_id');
		const teacherClassIds = teacherClasses.map(c => c._id.toString());
		const gameClassIds = (game.lop || []).map(c => (c._id || c).toString());
		const hasAccess = gameClassIds.some(id => teacherClassIds.includes(id));
		if (!hasAccess && game.nguoiTao?.toString() !== (req.user.id || req.user._id)?.toString()) {
			return res.status(403).json({
				success: false,
				message: 'Bạn không có quyền xem kết quả trò chơi này'
			});
		}

		const allStudents = [];
		for (const classId of gameClassIds) {
			const classData = await Class.findById(classId).populate('hocSinh', 'hoTen anhDaiDien');
			if (classData && classData.hocSinh && classData.hocSinh.length > 0) {
				allStudents.push(...classData.hocSinh.map(student => ({
					studentId: student._id,
					studentName: student.hoTen,
					className: classData.tenLop
				})));
			}
		}

		const studentIds = allStudents.map(s => s.studentId);
		const submittedProgress = await Progress.find({
			troChoi: gameId,
			treEm: { $in: studentIds },
			trangThai: 'hoanThanh',
			loai: 'troChoi'
		}).populate('treEm', 'hoTen');

		const submittedMap = new Map(
			submittedProgress.map(p => [p.treEm._id.toString(), p])
		);

		// Use teacher's score for coloring games if available
		const isColoringGameForReport = (game.loai === 'toMau' || game.type === 'coloring');

		// Build results array including students who haven't submitted (system score 0).
		// Include `teacherScore` property only when teacher has provided a numeric grade.
		let sumForAverage = 0;
		const results = allStudents.map(s => {
			const p = submittedMap.get(s.studentId.toString());
			const teacherScore = p && typeof p.diemGiaoVien === 'number' ? p.diemGiaoVien : null;
			const systemScore = p ? (p.diemSo || 0) : 0;
			const displayScore = isColoringGameForReport && teacherScore !== null ? teacherScore : systemScore;

			sumForAverage += displayScore;

			const resultObj = {
				studentName: s.studentName,
				className: s.className,
				// keep `score` as systemScore so consumers can still access raw system score
				score: systemScore,
				timeSpent: p ? (p.thoiGianDaDung || 0) : 0
			};

			if (teacherScore !== null) {
				resultObj.teacherScore = teacherScore;
			}

			return resultObj;
		});

		const summary = {
			totalStudents: allStudents.length,
			submittedCount: submittedProgress.length,
			notSubmittedCount: allStudents.length - submittedProgress.length,
			averageScore: allStudents.length > 0
				? Math.round(sumForAverage / allStudents.length)
				: 0
		};

		const outputDir = path.join(__dirname, '..', '..', 'uploads', 'reports');
		const { filePath, fileName } = await generateItemResultReportPdf({
			item: {
				title: game.tieuDe || game.title || 'Trò chơi',
				description: game.moTa || game.description || '',
				type: game.loai || game.type || '',
				category: game.danhMuc || game.category || ''
			},
			summary,
			results,
			outputDir
		});

		res.json({
			success: true,
			data: {
				message: 'Đã tạo file báo cáo PDF',
				fileName,
				fileUrl: `/uploads/reports/${fileName}`
			}
		});
	} catch (e) {
		next(e);
	}
};

// Giáo viên gửi báo cáo PDF kết quả trò chơi về email (có thể tạo lại file)
const sendGameResultsReportEmail = async (req, res, next) => {
	try {
		const { gameId } = req.params;
		const Progress = require('../models/TienDo');
		const Class = require('../models/Lop');

		if (!req.user || req.user.vaiTro !== 'giaoVien') {
			return res.status(403).json({
				success: false,
				message: 'Chỉ giáo viên mới được gửi báo cáo kết quả trò chơi'
			});
		}

		const teacher = await User.findById(req.user.id || req.user._id).select('email hoTen');
		if (!teacher || !teacher.email) {
			return res.status(400).json({
				success: false,
				message: 'Tài khoản giáo viên chưa có email, không thể gửi báo cáo'
			});
		}

		const game = await Game.findById(gameId).populate('lop', 'tenLop maLop giaoVien hocSinh');
		if (!game) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy trò chơi' });
		}

		const teacherClasses = await Class.find({ giaoVien: req.user.id || req.user._id }).select('_id');
		const teacherClassIds = teacherClasses.map(c => c._id.toString());
		const gameClassIds = (game.lop || []).map(c => (c._id || c).toString());
		const hasAccess = gameClassIds.some(id => teacherClassIds.includes(id));
		if (!hasAccess && game.nguoiTao?.toString() !== (req.user.id || req.user._id)?.toString()) {
			return res.status(403).json({
				success: false,
				message: 'Bạn không có quyền xem kết quả trò chơi này'
			});
		}

		const allStudents = [];
		for (const classId of gameClassIds) {
			const classData = await Class.findById(classId).populate('hocSinh', 'hoTen anhDaiDien');
			if (classData && classData.hocSinh && classData.hocSinh.length > 0) {
				allStudents.push(...classData.hocSinh.map(student => ({
					studentId: student._id,
					studentName: student.hoTen,
					className: classData.tenLop
				})));
			}
		}

		const studentIds = allStudents.map(s => s.studentId);
		const submittedProgress = await Progress.find({
			troChoi: gameId,
			treEm: { $in: studentIds },
			trangThai: 'hoanThanh',
			loai: 'troChoi'
		}).populate('treEm', 'hoTen');

		const submittedMap = new Map(
			submittedProgress.map(p => [p.treEm._id.toString(), p])
		);

		// Use teacher's score for coloring games if available
		const isColoringGameForReport = (game.loai === 'toMau' || game.type === 'coloring');

		// Build results array including students who haven't submitted (system score 0).
		// Include `teacherScore` property only when teacher has provided a numeric grade.
		let sumForAverageEmail = 0;
		const results = allStudents.map(s => {
			const p = submittedMap.get(s.studentId.toString());
			const teacherScore = p && typeof p.diemGiaoVien === 'number' ? p.diemGiaoVien : null;
			const systemScore = p ? (p.diemSo || 0) : 0;
			const displayScore = isColoringGameForReport && teacherScore !== null ? teacherScore : systemScore;

			sumForAverageEmail += displayScore;

			const resultObj = {
				studentName: s.studentName,
				className: s.className,
				score: systemScore,
				timeSpent: p ? (p.thoiGianDaDung || 0) : 0
			};

			if (teacherScore !== null) {
				resultObj.teacherScore = teacherScore;
			}

			return resultObj;
		});

		const summary = {
			totalStudents: allStudents.length,
			submittedCount: submittedProgress.length,
			notSubmittedCount: allStudents.length - submittedProgress.length,
			// average across all students using teacherScore when available for coloring games
			averageScore: allStudents.length > 0
				? Math.round(sumForAverageEmail / allStudents.length)
				: 0
		};

		const outputDir = path.join(__dirname, '..', '..', 'uploads', 'reports');
		const { filePath, fileName } = await generateItemResultReportPdf({
			item: {
				title: game.tieuDe || game.title || 'Trò chơi',
				description: game.moTa || game.description || '',
				type: game.loai || game.type || '',
				category: game.danhMuc || game.category || ''
			},
			summary,
			results,
			outputDir
		});

		await sendReportEmail({
			to: teacher.email,
			subject: `Báo cáo kết quả trò chơi: ${game.tieuDe || game.title || ''}`,
			html: `
				<p>Xin chào ${teacher.hoTen || 'thầy/cô'},</p>
				<p>Hệ thống gửi kèm báo cáo kết quả trò chơi <strong>${game.tieuDe || game.title || ''}</strong>.</p>
				<ul>
					<li>Tổng số học sinh: ${summary.totalStudents}</li>
					<li>Đã nộp: ${summary.submittedCount}</li>
					<li>Chưa nộp: ${summary.notSubmittedCount}</li>
					<li>Điểm trung bình: ${summary.averageScore}%</li>
				</ul>
				<p>Trân trọng.</p>
			`,
			pdfPath: filePath,
			pdfName: fileName
		});

		res.json({
			success: true,
			data: {
				message: 'Đã tạo và gửi báo cáo PDF tới email giáo viên',
				fileName
			}
		});
	} catch (e) {
		next(e);
	}
};

const getGameHistory = async (req, res, next) => {
	try {
		const { childId } = req.params;
		const { limit = 20, page = 1 } = req.query;
		const Progress = require('../models/TienDo');
		let targetChildId = childId;

		// Tìm Child với _id = childId (vì Child._id = User học sinh._id)
		const childDoc = await Child.findById(childId).select('_id');
		if (!childDoc) {
			// Nếu không tìm thấy Child, trả về rỗng
			return res.json({
				success: true,
				data: {
					history: [],
					pagination: {
						total: 0,
						page: parseInt(page),
						limit: parseInt(limit),
						pages: 0
					}
				}
			});
		}
		
		const progress = await Progress.find({ 
			treEm: targetChildId, 
			trangThai: 'hoanThanh',
			loai: 'troChoi'
		})
		.populate('troChoi', 'tieuDe loai danhMuc capDo anhDaiDien')
		.sort({ ngayHoanThanh: -1 })
		.limit(parseInt(limit))
		.skip((parseInt(page) - 1) * parseInt(limit));
		
		const total = await Progress.countDocuments({ 
			treEm: targetChildId, 
			trangThai: 'hoanThanh',
			loai: 'troChoi'
		});
		
		const responseData = { 
			success: true,
			data: {
				history: progress.map(p => ({
					id: p._id,
					game: p.troChoi ? {
						id: p.troChoi._id,
						title: p.troChoi.tieuDe,
						type: p.troChoi.loai,
						category: p.troChoi.danhMuc,
						level: p.troChoi.capDo,
						imageUrl: p.troChoi.anhDaiDien
					} : null,
					score: p.diemSo,
					teacherScore: typeof p.diemGiaoVien === 'number' ? p.diemGiaoVien : null,
					gradingStatus: p.trangThaiChamDiem || 'chuaCham',
					resultImage: p.tepKetQua || null,
					timeSpent: p.thoiGianDaDung,
					completedAt: p.ngayHoanThanh || p.createdAt,
					answers: p.cauTraLoi || []
				})),
				pagination: {
					page: parseInt(page),
					limit: parseInt(limit),
					total,
					pages: Math.ceil(total / parseInt(limit))
				}
			}
		};
		
		res.json(responseData);
	} catch (e) {
		next(e);
	}
};

// Giáo viên chấm điểm kết quả trò chơi (ví dụ game tô màu)
const gradeGameResult = async (req, res, next) => {
	try {
		const Progress = require('../models/TienDo');
		const Class = require('../models/Lop');

		if (!req.user || req.user.vaiTro !== 'giaoVien') {
			return res.status(403).json({
				success: false,
				message: 'Chỉ giáo viên mới được chấm điểm trò chơi'
			});
		}

		const { progressId } = req.params;

		const schema = Joi.object({
			teacherScore: Joi.number().min(0).max(100).required(),
			comment: Joi.string().allow('', null)
		});

		const { teacherScore, comment } = await schema.validateAsync(req.body);

		const progress = await Progress.findById(progressId).populate('troChoi');
		if (!progress || !progress.troChoi) {
			return res.status(404).json({
				success: false,
				message: 'Không tìm thấy kết quả trò chơi để chấm'
			});
		}

		// Kiểm tra quyền: giáo viên phải là GV của lớp có gán trò chơi này, hoặc là người tạo trò chơi
		const game = progress.troChoi;
		const teacherId = (req.user.id || req.user._id).toString();

		let hasAccess = false;
		if (game.lop && game.lop.length > 0) {
			const teacherClasses = await Class.find({ giaoVien: teacherId }).select('_id');
			const teacherClassIds = teacherClasses.map(c => c._id.toString());
			const gameClassIds = (game.lop || []).map(c => c._id ? c._id.toString() : c.toString());
			hasAccess = gameClassIds.some(id => teacherClassIds.includes(id));
		}

		if (!hasAccess && game.nguoiTao && game.nguoiTao.toString() === teacherId) {
			hasAccess = true;
		}

		if (!hasAccess) {
			return res.status(403).json({
				success: false,
				message: 'Bạn không có quyền chấm điểm kết quả này'
			});
		}

		progress.diemGiaoVien = teacherScore;
		progress.trangThaiChamDiem = 'daCham';
		if (typeof comment === 'string') {
			progress.ghiChu = comment;
		}

		await progress.save();

		return res.json({
			success: true,
			data: {
				progressId: progress._id,
				teacherScore: progress.diemGiaoVien,
				status: progress.trangThaiChamDiem
			}
		});
	} catch (e) {
		next(e);
	}
};

module.exports = {
	listGames,
	getGameById,
	createGame,
	updateGame,
	deleteGame,
	uploadPuzzleImage,
	uploadGuessImage,
	playGame,
	upload,
	createColoringGame,
	createPuzzleGame,
	createMatchingGame,
	createGuessingGame,
	saveGameResult,
	getGameHistory,
	getGameResults,
	gradeGameResult,
	exportGameResultsReport,
	sendGameResultsReportEmail
};