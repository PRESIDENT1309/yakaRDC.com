import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Ce fichier contrôle le HTML racine de l'app web.
// Il force la hauteur à 100vh pour que la barre d'onglets
// reste toujours visible en bas du navigateur.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{
          __html: `
            html, body {
              height: 100%;
              overflow: hidden;
            }
            #root {
              display: flex;
              flex-direction: column;
              height: 100vh;
              overflow: hidden;
            }
          `,
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}