/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Палитра SAVEAT — та же, что на вебе.
        sand: "#F1D7BE",
        card: "#FFFDF9",
        ink: "#3B2F2F",
        primary: "#D87979",
        "primary-dark": "#C96868",
        blush: "#F4DCDC",
        muted: "#8B7770",
        subtle: "#A18C84",
        line: "#EADFD6",
        border: "#DDCEC3",
        surface: "#FAF5EF",
        success: "#587852",
        danger: "#A64F55",
      },
    },
  },
  plugins: [],
};
