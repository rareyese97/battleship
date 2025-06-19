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
						backgroundColor: "#dc2626",
						boxShadow: "0 0 10px #facc15, 0 0 20px #facc15",
					},
					"50%": {
						backgroundColor: "#b91c1c",
						boxShadow: "0 0 20px #facc15, 0 0 30px #facc15",
					},
				},
			},
		},
	},
	plugins: [],
};
