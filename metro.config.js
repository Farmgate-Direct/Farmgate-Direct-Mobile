// Metro bundler config. NativeWind is wrapped around the default Expo config
// and told which CSS file holds the theme and utility classes.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');
 
const config = getDefaultConfig(__dirname)
 
module.exports = withNativeWind(config, { input: './app/global.css' })