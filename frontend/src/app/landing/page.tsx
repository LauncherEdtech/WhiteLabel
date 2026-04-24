import type { Metadata } from 'next';
import './landing.css';
import LandingClient from './LandingClient';

export const metadata: Metadata = {
  title: 'LauncherEDU',
  description: 'A plataforma white-label que aumenta retenção, valor percebido e receita para infoprodutores de concursos públicos.',
  openGraph: {
    title: 'LauncherEDU',
    description: 'Cronograma inteligente, banco de questões, simulados, gamificação e Mentor com IA.',
    url: 'https://launcheredu.com.br',
    siteName: 'Launcher',
    locale: 'pt_BR',
    type: 'website',
  },
};

export default function LandingPage() {
  return <LandingClient />;
}
