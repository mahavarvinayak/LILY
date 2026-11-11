import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "LILY — Let your next opportunity bloom",
    template: "%s · LILY",
  },
  description:
    "The autonomous B2B revenue pipeline for digital agencies. Verified, trigger-matched decision-makers and AI outreach delivered to your private workspace at 08:00 IST.",
  applicationName: "LILY",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://lily-dusky.vercel.app"),
  icons: {
    icon: [
      { url: "/favicon.svg?v=6", type: "image/svg+xml" },
      { url: "/favicon-64.png?v=6", sizes: "64x64", type: "image/png" },
      { url: "/favicon.ico?v=6", sizes: "32x32" },
    ],
    apple: "/favicon-64.png?v=6",
    shortcut: "/favicon.svg?v=6",
  },
  openGraph: {
    title: "LILY — Let your next opportunity bloom",
    description:
      "Fresh signals. Verified decision-makers. A quieter way to grow your agency, every morning at 08:00 IST.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f1c18",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${manrope.variable} ${jetbrains.variable} dark scroll-smooth`}
    >
      <body className="font-sans antialiased bg-background text-foreground min-h-screen">
        {children}
        <Toaster />
      </body>
    </html>
  );
}

