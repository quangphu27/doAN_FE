const dotenv = require('dotenv');
const app = require('./app');
const os = require('os');

dotenv.config();

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log(`📖 Swagger docs available at http://localhost:${port}/api-docs`);

  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`🌐 LAN access: http://${iface.address}:${port}`);
      }
    }
  }
});
