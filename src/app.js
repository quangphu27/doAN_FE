const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');
const { connectDatabase } = require('./config/db');
const errorHandler = require('./middleware/error');
const apiRoutes = require('./routes');
const { setupSwagger } = require('./docs/swagger');

dotenv.config();
connectDatabase();

const app = express();
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'cookie'));
if (process.env.NODE_ENV !== 'test') {
	app.use(morgan('dev'));
}

setupSwagger(app);
app.use('/api', apiRoutes);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use(errorHandler);
module.exports = app;
