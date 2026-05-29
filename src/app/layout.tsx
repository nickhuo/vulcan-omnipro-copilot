import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vulcan OmniPro 220 Copilot",
  description:
    "A multimodal reasoning agent for the Vulcan OmniPro 220 welder. Grounded in the manual, every answer cited.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
