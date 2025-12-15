const Joi = require('joi');
const Game = require('../models/TroChoi');
const Child = require('../models/TreEm');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

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

		// Học sinh: chỉ xem game thuộc các lớp mà mình đang học
		if (req.user && req.user.vaiTro === 'hocSinh') {
			const Class = require('../models/Lop');

			// Tìm hồ sơ TreEm tương ứng với tài khoản học sinh
			const child = await Child.findOne({ phuHuynh: req.user.id || req.user._id }).select('_id');

			// Nếu chưa có hồ sơ TreEm / chưa được thêm vào lớp → không có quyền xem trò chơi
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
		const child = await Child.findOne({ _id: childId, parent: req.user.id });
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
			const childRecord = await Child.findOne({ phuHuynh: req.user.id || req.user._id });
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
			soLanThu: 1
		};

		if (req.file) {
			progressData.tepKetQua = req.file.path;
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

		const progress = new Progress(progressData);
		await progress.save();
		
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

		const game = await Game.findById(gameId).populate('lop', 'tenLop maLop giaoVien hocSinh');
		if (!game) {
			return res.status(404).json({ success: false, message: 'Không tìm thấy trò chơi' });
		}

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

		const submittedStudents = allStudents
			.filter(s => submittedStudentIds.has(s.studentId.toString()))
			.map(student => {
				const progress = submittedProgress.find(p => p.treEm._id.toString() === student.studentId.toString());
				return {
					studentId: student.studentId,
					studentName: student.studentName,
					studentAvatar: student.studentAvatar,
					classId: student.classId,
					className: student.className,
					score: progress.diemSo || 0,
					timeSpent: progress.thoiGianDaDung || 0,
					completedAt: progress.ngayHoanThanh || progress.updatedAt,
					attempts: progress.soLanThu || 1,
					resultImage: progress.tepKetQua || null,
					answers: (progress.cauTraLoi || []).map((answer, idx) => {
						const qInfo = questionMap.get(answer.idBaiTap);
						const fallbackLabel = `Câu ${idx + 1}`;
						return {
							exerciseId: answer.idBaiTap, // giữ nguyên id kỹ thuật
							displayId: qInfo?.label || fallbackLabel, // FE dùng để hiển thị
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

const getGameHistory = async (req, res, next) => {
	try {
		const { childId } = req.params;
		const { limit = 20, page = 1 } = req.query;
		const Progress = require('../models/TienDo');
		let targetChildId = childId;

		const childDoc = await Child.findById(childId).select('_id');
		if (!childDoc) {
			const fallbackChild = await Child.findOne({ phuHuynh: childId }).select('_id');
			if (fallbackChild) {
				targetChildId = fallbackChild._id;
			} else {
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
	getGameResults
};