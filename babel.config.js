// Babel config for the Expo app. The jsxImportSource points JSX at NativeWind
// so className works in components, and the NativeWind preset compiles those
// classes.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};