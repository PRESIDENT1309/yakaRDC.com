// Corrige la langue déclarée du HTML produit par `expo export -p web`.
//
// POURQUOI CE SCRIPT EXISTE
// En mode page unique — le défaut, et le nôtre — Expo ignore `app/+html.tsx`
// et utilise son propre gabarit, figé sur `lang="en"`. L'app est pourtant
// entièrement en français.
//
// CE QUE ÇA CASSAIT
// Chrome lit `lang="en"`, croit avoir affaire à de l'anglais, et traduit
// automatiquement toute la page vers le français. La traduction repasse sur
// des textes DÉJÀ français et les déforme : « Enregistrer » devenait
// « Économiser ». Les messages d'erreur y passaient aussi, rendant le
// diagnostic impossible — on lisait une traduction d'une traduction.
//
// On ne pose PAS `notranslate` : un visiteur lingalaphone ou anglophone doit
// pouvoir demander une traduction. On corrige seulement le mensonge sur la
// langue d'origine.

import { readFile, writeFile } from 'node:fs/promises';

const FICHIER = 'dist/index.html';

const html = await readFile(FICHIER, 'utf8');

if (!html.includes('<html lang="en">')) {
  console.log(`[fix-html-lang] ${FICHIER} : rien à corriger`);
  process.exit(0);
}

await writeFile(FICHIER, html.replace('<html lang="en">', '<html lang="fr">'));
console.log(`[fix-html-lang] ${FICHIER} : lang="en" → lang="fr"`);
