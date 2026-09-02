import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  // Poppins isn't a variable font on Google Fonts, so the weights the
  // app actually uses (font-normal/medium/semibold/bold) must be listed
  // explicitly — next/font only downloads what's requested here.
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "FinPRO",
  description:
    "Uma forma simples de organizar, planejar e acompanhar sua vida financeira.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
