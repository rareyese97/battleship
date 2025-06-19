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
						backgroundColor: "rgba(220, 38, 38, 0.6)", 
						boxShadow: "0 0 10px rgba(250, 204, 21, 0.8), 0 0 20px rgba(250, 204, 21, 0.8)",
					},
					"50%": {
						backgroundColor: "rgba(185, 28, 28, 0.3)", 
						boxShadow: "0 0 20px rgba(250, 204, 21, 1), 0 0 30px rgba(250, 204, 21, 1)",
					},
				},
			},
		},
	},
	plugins: [],
};
