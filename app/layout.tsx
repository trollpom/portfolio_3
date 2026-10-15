import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.DEPLOY_PRIME_URL || process.env.URL || "http://localhost:3000"),
  title: "Анна и Михаил — 17 июля 2027",
  description: "Приглашение на день, который мы хотим разделить с вами. Свадебный демопроект: история пары, программа, дресс-код и подтверждение участия.",
  openGraph: { title: "Анна & Михаил — приглашение на свадьбу", description: "17 июля 2027. Будем счастливы разделить этот день с вами. Демопроект для портфолио.", images: ["/images/couple.webp"], locale: "ru_RU", type: "website" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
