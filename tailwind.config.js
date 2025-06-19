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
				"strong-pulse": "strong-pulse 1s infinite",
			},
			keyframes: {
				"strong-pulse": {
					"0%, 100%": {
						backgroundColor: "rgba(220, 38, 38, 0.6)", 
						boxShadow: "0 0 8px rgba(250, 204, 21, 0.5), 0 0 16px rgba(250, 204, 21, 0.5)",
					},
					"50%": {
						backgroundColor: "rgba(185, 28, 28, 0.5)", 
						boxShadow: "0 0 16px rgba(250, 204, 21, 0.5), 0 0 24px rgba(250, 204, 21, 0.5)",
					},
				},
			},
		},
	},
	plugins: [],
};
