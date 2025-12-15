const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const { 
	listGames, 
	getGameById, 
	playGame, 
	createGame, 
	updateGame, 
	deleteGame,
	uploadPuzzleImage,
	uploadGuessImage,
	upload,
	createColoringGame,
	createPuzzleGame,
	createMatchingGame,
	createGuessingGame,
	saveGameResult,
	getGameHistory,
	getGameResults
} = require('../../controllers/gameController');
const router = express.Router();
router.use(authenticate);
 
router.get('/', listGames);
router.get('/:id', getGameById);

router.post(
	'/:id/play', 
	authorize(['parent', 'child', 'phuHuynh', 'hocSinh', 'admin']), 
	playGame
);

router.post('/', authorize(['giaoVien']), createGame);
router.put('/:id', authorize(['giaoVien']), updateGame);
router.delete('/:id', authorize(['admin', 'giaoVien']), deleteGame);
router.post('/upload/puzzle', authorize(['giaoVien']), upload.single('image'), uploadPuzzleImage);
router.post('/upload/guess', authorize(['giaoVien']), upload.single('image'), uploadGuessImage);
router.post('/create/coloring', authorize(['admin']), upload.single('outlineImage'), createColoringGame);
router.post('/create/puzzle', authorize(['admin']), upload.single('originalImage'), createPuzzleGame);
router.post('/create/matching', authorize(['admin']), createMatchingGame);
router.post('/create/guessing', authorize(['admin']), upload.array('media', 20), createGuessingGame);
router.post(
	'/result', 
	authorize(['parent', 'child', 'phuHuynh', 'hocSinh', 'admin']), 
	upload.single('resultImage'), 
	saveGameResult
);
router.get(
	'/child/:childId/history', 
	authorize(['parent', 'child', 'phuHuynh', 'hocSinh', 'admin']), 
	getGameHistory
);
router.get('/:gameId/results', authorize(['admin', 'giaoVien']), getGameResults);

module.exports = router;