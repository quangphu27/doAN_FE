const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

function setupSwagger(app) {
	const swaggerDocument = YAML.load(require('path').join(__dirname, 'swagger.yaml'));
	app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

module.exports = { setupSwagger };
