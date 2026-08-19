import { Alert as RNAlert, Platform } from 'react-native';

// Remplacement de react-native/Alert, compatible web.
//
// Pourquoi : dans react-native-web, Alert.alert est littéralement vide
// (`class Alert { static alert() {} }`). Tout bouton dont le seul retour
// était une alerte ne faisait donc RIEN sur le web — l'app y perdait ses
// confirmations de suppression, ses messages d'erreur de formulaire et ses
// accusés de réception, sans le moindre signe visible.
//
// L'API est volontairement identique à celle de React Native, pour que les
// appels existants fonctionnent sans être réécrits : seul l'import change.
// Sur mobile, on délègue tel quel à l'implémentation native.

export interface AlertButton {
  text?: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
}

function webAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  const text = message ? `${title}\n\n${message}` : title;

  // Aucun bouton, ou un seul : simple accusé de réception.
  if (!buttons || buttons.length === 0) {
    window.alert(text);
    return;
  }
  if (buttons.length === 1) {
    window.alert(text);
    buttons[0].onPress?.();
    return;
  }

  // Deux boutons ou plus : confirmation. On considère « annuler » comme le
  // bouton de style cancel (ou, à défaut, le premier), et l'action comme le
  // premier bouton qui n'est pas un cancel.
  const cancel = buttons.find(b => b.style === 'cancel') ?? buttons[0];
  const confirm = buttons.find(b => b !== cancel && b.style !== 'cancel') ?? buttons[buttons.length - 1];

  // Limite connue : au-delà de deux choix, window.confirm ne peut en proposer
  // que deux. Aucun appel de l'app n'est dans ce cas aujourd'hui ; si cela
  // arrive, c'est le premier choix non-cancel qui est proposé.
  if (window.confirm(text)) confirm.onPress?.();
  else cancel.onPress?.();
}

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]): void {
    if (Platform.OS === 'web') {
      webAlert(title, message, buttons);
      return;
    }
    RNAlert.alert(title, message, buttons);
  },
};
