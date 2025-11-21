#!/usr/bin/env node
/**
 * JWT Secret Generator
 * Run this script to generate cryptographically secure JWT secrets
 * Usage: node generate-jwt-secrets.js
 */

const crypto = require('crypto');

console.log('='.repeat(70));
console.log('JWT SECRET GENERATOR');
console.log('='.repeat(70));
console.log('\nGenerating cryptographically secure random secrets...\n');

const jwtSecret = crypto.randomBytes(64).toString('hex');
const jwtRefreshSecret = crypto.randomBytes(64).toString('hex');

console.log('Add these to your .env file:\n');
console.log('JWT_SECRET=' + jwtSecret);
console.log('JWT_REFRESH_SECRET=' + jwtRefreshSecret);
console.log('\n' + '='.repeat(70));
console.log('\nIMPORTANT SECURITY NOTES:');
console.log('1. Never commit these secrets to version control');
console.log('2. Use different secrets for development and production');
console.log('3. Store production secrets in a secure vault (e.g., AWS Secrets Manager)');
console.log('4. Rotate secrets periodically');
console.log('5. Keep JWT_SECRET and JWT_REFRESH_SECRET different');
console.log('='.repeat(70));
