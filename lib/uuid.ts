/**
 * Génération d'un identifiant UUID v4 côté client.
 *
 * POURQUOI EN AVOIR BESOIN
 * Récupérer l'identifiant d'une ligne qu'on vient d'insérer suppose un
 * `INSERT ... RETURNING`, donc de pouvoir RELIRE cette ligne. Sur
 * `partner_requests`, la lecture est réservée au propriétaire de la demande —
 * ce qu'un visiteur anonyme n'est pas. L'insertion réussit, mais la relecture
 * échoue, et Postgres remonte une erreur de politique qui laisse croire que
 * l'écriture a été refusée.
 *
 * En choisissant l'identifiant AVANT d'insérer, on le connaît sans rien
 * relire. Le formulaire peut alors déclencher l'accusé de réception sans
 * exiger un droit de lecture qu'il n'a aucune raison d'avoir.
 *
 * SUR LA QUALITÉ DE L'ALÉA
 * `crypto.randomUUID` puis `crypto.getRandomValues` sont préférés. Le repli
 * sur `Math.random` ne sert qu'aux environnements sans API cryptographique :
 * il suffit ici, parce qu'un identifiant de ligne n'est pas un secret — il
 * n'a besoin d'être qu'unique, jamais imprévisible. Ne pas réutiliser ce
 * module pour un jeton ou un mot de passe.
 */
export function uuidv4(): string {
  const c: Crypto | undefined = typeof globalThis !== 'undefined'
    ? (globalThis as any).crypto
    : undefined;

  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  // Version 4, variante RFC 4122.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex: string[] = [];
  for (let i = 0; i < 16; i++) hex.push(bytes[i].toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}
