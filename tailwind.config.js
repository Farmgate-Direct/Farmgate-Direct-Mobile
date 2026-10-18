/** @type {import('tailwindcss').Config} */
module.exports = {
  // Every folder that can contain Nativewind class names.
  content: ["./app/**/*.{js,jsx,ts,tsx}","./components/**/*.{js,jsx,ts,tsx}","./src/**/*.{js,jsx,ts,tsx}","./context/**/*.{js,jsx,ts,tsx}","./constants/**/*.{js,jsx,ts,tsx}","./utils/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
}