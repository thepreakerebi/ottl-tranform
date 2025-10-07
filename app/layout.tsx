import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import DndProvider from "../components/providers/DndProvider";
import A11yProvider from "../components/providers/A11yProvider";
import WorkersProvider from "../components/providers/WorkersProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OTTL Transformer",
  description: "Transform your telemetry data with ease",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} antialiased`}
        suppressHydrationWarning
      >
        <A11yProvider>
          <WorkersProvider>
            <DndProvider>
              {children}
            </DndProvider>
          </WorkersProvider>
        </A11yProvider>
      </body>
    </html>
  );
}
