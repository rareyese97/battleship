// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
	content: [
		"./src/**/*.{js,ts,jsx,tsx}",
		"./app/**/*.{js,ts,jsx,tsx}",
		// etc
	],
	safelist: ["animate-strong-pulse"],
	theme: {
		extend: {},
	},
	plugins: [],
};
