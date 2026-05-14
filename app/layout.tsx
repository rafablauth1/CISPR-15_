import type { Metadata } from 'next'
import { Syne, Figtree, DM_Mono } from 'next/font/google'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['400', '600', '700', '800'],
})

const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  weight: ['300', '400', '500', '600'],
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-dm-mono',
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: 'CISPR 15 — LABELO/PUCRS',
  description: 'Gerador de Relatórios CISPR 15 · LABELO PUCRS',
  icons: { icon: '/favicon.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${syne.variable} ${figtree.variable} ${dmMono.variable}`}>
      <body className="bg-navy text-white antialiased font-body">
        {children}
      </body>
    </html>
  )
}
