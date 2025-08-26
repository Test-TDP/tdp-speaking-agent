/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}"  // ok to leave; app/ will be deleted anyway
  ],
  theme: { extend: {} },
  plugins: [],
};
