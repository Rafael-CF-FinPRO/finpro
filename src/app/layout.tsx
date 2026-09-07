import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { cookies } from "next/headers";
import { THEME_COOKIE_NAME, isValidTheme } from "@/lib/theme";
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // A plain (non-httpOnly) cookie set by ThemeToggle — reading it here
  // lets the very first server-rendered HTML already carry the right
  // data-theme, so there's no flash-of-wrong-theme script needed.
  // Absent cookie = "system": omit the attribute entirely and let
  // globals.css's prefers-color-scheme media query decide.
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get(THEME_COOKIE_NAME)?.value;
  const theme = isValidTheme(themeCookie) ? themeCookie : undefined;

  return (
    <html
      lang="pt-BR"
      data-theme={theme}
      className={`${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
