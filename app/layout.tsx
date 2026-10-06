import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NOTECOACH 3.0',
  description: 'Notas, áudio e análise de futebol para treinadores e analistas.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-PT"><body>{children}</body></html>;
}
