import type { Metadata } from "next";
import type { ReactNode } from "react";
import AppNav from "../components/app-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ambient Video Studio",
  description: "Generate ambient videos from a theme, style, and duration."
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppNav />
        {children}
      </body>
    </html>
  );
}
