
import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { headers } from 'next/headers'
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from "@vercel/analytics/next"
import { cn } from "@/lib/utils";
import Wagmi_Provider from "@/config/Wagmi_Provider";
import Theme from "@/config/Theme";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });


export async function generateMetadata(): Promise<Metadata> {
  const Title = 'Coolha'

  return {
    title: {
      template: `%s | ${Title}`,
      default: Title,
    },
    description: "Coolha App",
    metadataBase: new URL('https://coolha.com'),
    icons: {
      icon: '/favicon.ico',
      shortcut: '/shortcut-icon.png',
      apple: '/apple-icon.png',
    },
    manifest: '/manifest.json',

  }
}
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});




export default async function RootLayout({ children, }: Readonly<{ children: React.ReactNode; }>) {
  const headersObj = await headers();
  const cookies = headersObj.get('cookie')
  const locale = await getLocale();
  const messages = (await import(`../i18n/${locale}.json`)).default;
  const walletProjectId = process.env.NEXT_PUBLIC_REOWN_ID || process.env.REOWN_ID || null

  return (
    <html lang={locale} suppressHydrationWarning className={cn("font-sans", inter.variable)}>
      <head>
        <meta name="talentapp:project_verification" content="3b8c0a3f9992f43448334d9ad892606045b08bb7e5b6a1abb0b31d6acdae4bee2cef56cf646f1ec2c19298f251d6af3229056d828568fd812b331c12e1cfd301"></meta>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Theme>
            <Wagmi_Provider cookies={cookies} walletProjectId={walletProjectId}>
              {children}
            </Wagmi_Provider>
          </Theme>
        </NextIntlClientProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
