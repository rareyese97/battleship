/** @type {import('tailwindcss').Config} */
module.exports = {
	content: [
		"./app/**/*.{js,ts,jsx,tsx}",
		"./components/**/*.{js,ts,jsx,tsx}",
		"./pages/**/*.{js,ts,jsx,tsx}",
		"./src/**/*.{js,ts,jsx,tsx}",
	],
	theme: {
		extend: {
			animation: {
				"strong-pulse": "strong-pulse 0.6s ease-in-out infinite",
			},
			keyframes: {
				"strong-pulse": {
					"0%, 100%": {
						backgroundColor: "rgba(34, 197, 94, 0.8)", // GREEN 500
						boxShadow: "0 0 10px rgba(34, 197, 94, 0.8), 0 0 20px rgba(34, 197, 94, 0.8)", // GREEN glow
					},
					"50%": {
						backgroundColor: "rgba(21, 128, 61, 0.5)", // GREEN 700 darker
						boxShadow: "0 0 20px rgba(34, 197, 94, 1), 0 0 30px rgba(34, 197, 94, 1)", // GREEN glow
					},
				},
			},
		},
	},

	plugins: [],
};
