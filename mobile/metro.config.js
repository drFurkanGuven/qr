const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Metro dosya izleyicisinin sadece mobile klasörüne odaklanmasını sağla
config.watchFolders = [__dirname];

module.exports = config;
