import { createContext, useContext, useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// Confirmation impérative, appelable depuis n'importe quel gestionnaire :
//
//   if (!(await confirm({ title: '…', destructive: true }))) return;
//
// Forme volontairement proche de window.confirm (une promesse de booléen)
// pour que les gestionnaires existants restent lisibles, mais rendue par un
// vrai composant aux jetons du design system.
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  // La promesse en attente : résolue par le choix de l'utilisateur.
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    // Une confirmation déjà ouverte est abandonnée (répondue « non ») plutôt
    // que laissée en suspens — sinon sa promesse ne se résoudrait jamais.
    resolver.current?.(false);
    setOpts(next);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  function settle(value: boolean) {
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {/* Rendu seulement quand une confirmation est demandée. Un Modal
          `visible={false}` laisse tout de même ses enfants dans le DOM sur le
          web : les libellés par défaut (« Annuler », « Confirmer ») se
          retrouvaient alors dans le texte de chaque page, lisibles par les
          lecteurs d'écran alors qu'aucun dialogue n'était ouvert. */}
      {opts !== null && (
        <ConfirmDialog
          visible
          title={opts.title}
          message={opts.message}
          confirmLabel={opts.confirmLabel ?? 'Confirmer'}
          cancelLabel={opts.cancelLabel ?? 'Annuler'}
          destructive={opts.destructive}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm doit être utilisé dans un ConfirmProvider');
  return ctx;
}
