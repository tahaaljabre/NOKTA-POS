const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  // POS tablets connect over the restaurant LAN; authentication protects the API.
  host: process.env.HOST || '0.0.0.0',
  dbDir: process.env.POS_DATA_DIR ? path.resolve(process.env.POS_DATA_DIR) : path.join(__dirname, '..', '..', 'data'),
  dbPath: process.env.POS_DATA_DIR ? path.join(path.resolve(process.env.POS_DATA_DIR),'pos.sqlite') : path.join(__dirname, '..', '..', 'data', 'pos.sqlite'),
  tlsKeyPath: process.env.TLS_KEY_PATH,
  tlsCertPath: process.env.TLS_CERT_PATH,
  publicDir: path.join(__dirname, '..', '..', 'public'),
  jwtSecret: process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex'),
  defaultLanguage: 'ar',
  defaultCurrency: '฿'
};
