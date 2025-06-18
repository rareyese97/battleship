// src/app/layout.tsx
import "./globals.css";
import Navbar from "./components/Navbar"; // adjust path if needed

export const metadata = {
	title: "Sink That Ship",
	description: "Play Battleship online",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body>
				{/* Navbar on every page */}
				<Navbar />
				{/* Your page content */}
				<main>{children}</main>
			</body>
		</html>
	);
}
