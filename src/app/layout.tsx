import type { Metadata } from "next";
import { Inter, Noto_Sans_SC, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://kb-zeta-one.vercel.app"),
  title: "KB Studio | Neural Workspace · 第二大脑",
  description:
    "KB Studio · 个人第二大脑工作台 —— 九大模块一屏总览：知识核心图谱、技能库、作品库、日历、健康与财务同步。",
  robots: { index: false, follow: false },
  openGraph: {
    title: "KB Studio",
    description:
      "个人第二大脑工作台 —— 九大模块、知识核心图谱、健康与财务同步，一屏总览。",
    url: "https://kb-zeta-one.vercel.app/studio",
    siteName: "KB Studio",
    images: [
      {
        url: "/studio/hud/core-sphere.webp",
        width: 1600,
        height: 1600,
        alt: "KB Studio Neural Orb",
      },
    ],
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "KB Studio",
    description:
      "个人第二大脑工作台 —— 九大模块、知识核心图谱、健康与财务同步，一屏总览。",
    images: ["/studio/hud/core-sphere.webp"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${inter.variable} ${notoSansSC.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground font-sans">
        {children}
      </body>
    </html>
  );
}
