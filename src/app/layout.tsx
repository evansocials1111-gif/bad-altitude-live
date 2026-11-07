import type { Metadata, Viewport } from "next";
import { Anton, JetBrains_Mono, Manrope } from "next/font/google";
import { AppProvider } from "@/lib/client/AppProvider";
import { AuthModal } from "@/components/AuthModal";
import { Footer, Nav } from "@/components/Nav";
import "./globals.css";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_SHOW_NAME || "Degen Den",
  description: "Two degenerate roommates on one couch, live 24/7, roasting whatever you type in chat. AI characters. 18+.",
};
export const viewport: Viewport = { themeColor: "#060608", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${anton.variable} ${manrope.variable} ${jetbrains.variable}`}>
      <body>
        <AppProvider>
          <Nav />
          <main>{children}</main>
          <Footer />
          <AuthModal />
        </AppProvider>
      </body>
    </html>
  );
}
