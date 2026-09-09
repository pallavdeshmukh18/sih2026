const crypto = require('crypto');
const configuredSecret = process.env.JWT_SECRET?.trim();
if (process.env.NODE_ENV === 'production' && (!configuredSecret || configuredSecret.length < 32)) {
    throw new Error('JWT_SECRET must contain at least 32 characters in production.');
}
module.exports = { JWT_SECRET: configuredSecret || crypto.randomBytes(48).toString('hex') };
