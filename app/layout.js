import "./globals.css";

export const metadata = {
  title: "Mi Horario — arma tu horario hablando con IA",
  description: "Dile a la IA tus actividades y ella arma tu horario semanal.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
