import { CameraView, useCameraPermissions } from 'expo-camera';
import { Camera, CheckCircle, Keyboard, QrCode, Search, XCircle } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable, StyleSheet,
  Text, TextInput,
  View,
} from 'react-native';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';

type ScanFailure = 'not_found' | 'wrong_establishment' | 'unknown';

type ScanResult = {
  success: boolean;
  alreadyUsed?: boolean;
  usedAt?: string;
  failure?: ScanFailure;
} | null;

type Mode = 'camera' | 'manual';

// validate_ticket distingue deux refus par un raise exception ; tout le reste
// (réseau, RLS, panne) reste 'unknown' pour ne pas accuser le ticket à tort.
function failureFromError(message?: string): ScanFailure {
  const m = (message ?? '').toLowerCase();
  if (m.includes('introuvable')) return 'not_found';
  if (m.includes('appartient')) return 'wrong_establishment';
  return 'unknown';
}

export default function ScanScreen() {
  const { profile } = useAuth();
  const [mode, setMode] = useState<Mode>('camera');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const scanLockRef = useRef(false);

  // Le QR encode qr_token, un uuid que Postgres rend en minuscules : le passer
  // en majuscules le rendrait introuvable. Seule la saisie manuelle est
  // normalisée, car unique_code est stocké en majuscules ('YK-' || upper(...)).
  async function runValidation(rawCode: string, options?: { normalize?: boolean }) {
    if (!rawCode.trim() || !profile?.id) return;
    setLoading(true);
    setResult(null);

    const trimmed = rawCode.trim();

    try {
      const { data, error } = await supabase.rpc('validate_ticket', {
        p_code: options?.normalize ? trimmed.toUpperCase() : trimmed,
        p_validator: profile.id,
      });

      if (error) {
        setResult({ success: false, failure: failureFromError(error.message) });
      } else if (data && data.length > 0) {
        const row = data[0];
        setResult({ success: true, alreadyUsed: row.already_used, usedAt: row.used_at });
      } else {
        setResult({ success: false, failure: 'not_found' });
      }
    } catch {
      setResult({ success: false, failure: 'unknown' });
    }

    setLoading(false);
  }

  function handleBarcodeScanned({ data }: { data: string }) {
    // Empêche de traiter le même flux vidéo plusieurs fois pendant qu'un
    // résultat est déjà affiché — le partenaire doit d'abord réinitialiser.
    if (scanLockRef.current || loading || result) return;
    scanLockRef.current = true;
    runValidation(data);
  }

  function handleReset() {
    setCode('');
    setResult(null);
    scanLockRef.current = false;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scanner un ticket</Text>
        <Text style={styles.headerSub}>
          {mode === 'camera' ? 'Visez le QR code du client' : 'Entrez le code du ticket du client'}
        </Text>
      </View>

      {/* Bascule caméra / saisie manuelle */}
      <View style={styles.modeSwitch}>
        <Pressable
          style={[styles.modeBtn, mode === 'camera' && styles.modeBtnActive]}
          onPress={() => { setMode('camera'); handleReset(); }}
        >
          <Camera size={14} color={mode === 'camera' ? '#FAF8F4' : colors.muted} />
          <Text style={[styles.modeBtnText, mode === 'camera' && styles.modeBtnTextActive]}>Caméra</Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, mode === 'manual' && styles.modeBtnActive]}
          onPress={() => { setMode('manual'); handleReset(); }}
        >
          <Keyboard size={14} color={mode === 'manual' ? '#FAF8F4' : colors.muted} />
          <Text style={[styles.modeBtnText, mode === 'manual' && styles.modeBtnTextActive]}>Saisie manuelle</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {mode === 'camera' && !result && (
          <View style={styles.cameraCard}>
            {!permission ? (
              <ActivityIndicator color={colors.lave} style={{ marginVertical: 40 }} />
            ) : !permission.granted ? (
              <View style={styles.permissionBox}>
                <Camera size={32} color={colors.faint} />
                <Text style={styles.permissionText}>
                  L'accès à la caméra est nécessaire pour scanner les tickets.
                </Text>
                <Pressable style={styles.permissionBtn} onPress={requestPermission}>
                  <Text style={styles.permissionBtnText}>Autoriser la caméra</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.cameraWrapper}>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={handleBarcodeScanned}
                />
                <View style={styles.viewfinder} pointerEvents="none" />
                {loading && (
                  <View style={styles.cameraLoadingOverlay}>
                    <ActivityIndicator color="#FAF8F4" />
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {mode === 'manual' && !result && (
          <View style={styles.codeCard}>
            <QrCode size={36} color={colors.lave} style={{ alignSelf: 'center', marginBottom: 14 }} />
            <Text style={styles.codeLabel}>Code du ticket</Text>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={t => { setCode(t); setResult(null); }}
              placeholder="YK-XXXXXXX"
              placeholderTextColor={colors.faint}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={10}
            />
            <Text style={styles.codeHint}>
              Le code figure sur le ticket du client (ex : YK-4F9X2A)
            </Text>
            <Pressable
              style={[styles.validateBtn, (!code.trim() || loading) && styles.validateBtnDisabled]}
              onPress={() => runValidation(code, { normalize: true })}
              disabled={!code.trim() || loading}
            >
              {loading
                ? <ActivityIndicator color="#FAF8F4" />
                : <><Search size={16} color="#FAF8F4" /><Text style={styles.validateBtnText}>Valider le ticket</Text></>
              }
            </Pressable>
          </View>
        )}

        {/* Résultat — commun aux deux modes */}
        {result && (
          <View style={[
            styles.resultCard,
            result.success && !result.alreadyUsed ? styles.resultSuccess :
            result.success && result.alreadyUsed ? styles.resultWarning :
            styles.resultError,
          ]}>
            {result.success && !result.alreadyUsed ? (
              <>
                <CheckCircle size={40} color="#1F4D3A" />
                <Text style={[styles.resultTitle, { color: '#1F4D3A' }]}>✅ Ticket valide</Text>
                <Text style={styles.resultText}>Le client est enregistré. Ce code est maintenant invalidé.</Text>
              </>
            ) : result.success && result.alreadyUsed ? (
              <>
                <XCircle size={40} color="#854F0B" />
                <Text style={[styles.resultTitle, { color: '#854F0B' }]}>⚠️ Ticket déjà utilisé</Text>
                <Text style={styles.resultText}>
                  Ce code a déjà été scanné.
                  {result.usedAt ? `\n(${new Date(result.usedAt).toLocaleString('fr-FR')})` : ''}
                </Text>
              </>
            ) : (
              <>
                <XCircle size={40} color="#C0392B" />
                <Text style={[styles.resultTitle, { color: '#C0392B' }]}>
                  {result.failure === 'wrong_establishment'
                    ? '⛔ Autre établissement'
                    : result.failure === 'unknown'
                    ? '⚠️ Validation impossible'
                    : '❌ Code inconnu'}
                </Text>
                <Text style={styles.resultText}>
                  {result.failure === 'wrong_establishment'
                    ? "Ce ticket est valide mais concerne un autre établissement. Il ne peut pas être validé ici."
                    : result.failure === 'unknown'
                    ? "La validation n'a pas pu aboutir. Vérifiez votre connexion, puis réessayez."
                    : "Ce code ne correspond à aucun ticket. Vérifiez la saisie ou demandez au client d'afficher à nouveau son QR code."}
                </Text>
              </>
            )}
            <Pressable style={styles.resetBtn} onPress={handleReset}>
              <Text style={styles.resetBtnText}>Scanner un autre ticket</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.note}>
          <Text style={styles.noteText}>
            💡 Le client peut vous montrer son QR code ou vous lire son code à voix haute. Chaque code ne peut être validé qu'une seule fois.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    backgroundColor: colors.lave,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 16, paddingHorizontal: 20,
  },
  headerTitle: { fontSize: 20, fontWeight: '500', color: '#FAF8F4' },
  headerSub: { fontSize: 13, color: 'rgba(250,248,244,0.7)', marginTop: 4 },
  modeSwitch: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FAF8F4', borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.borderStrong,
    borderRadius: 10, paddingVertical: 9,
  },
  modeBtnActive: { backgroundColor: colors.lave, borderColor: colors.lave },
  modeBtnText: { fontSize: 12.5, color: colors.muted },
  modeBtnTextActive: { color: '#FAF8F4', fontWeight: '500' },
  content: { padding: 16, gap: 16 },
  cameraCard: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, overflow: 'hidden',
  },
  cameraWrapper: { width: '100%', aspectRatio: 1, position: 'relative', backgroundColor: '#000' },
  viewfinder: {
    position: 'absolute', top: '18%', left: '18%', right: '18%', bottom: '18%',
    borderWidth: 3, borderColor: '#FAF8F4', borderRadius: 20,
  },
  cameraLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  permissionBox: { alignItems: 'center', gap: 12, padding: 32 },
  permissionText: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 },
  permissionBtn: { backgroundColor: colors.lave, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 11 },
  permissionBtnText: { fontSize: 13, color: '#FAF8F4', fontWeight: '500' },
  codeCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 20 },
  codeLabel: { fontSize: 13, fontWeight: '500', color: colors.ink, marginBottom: 8 },
  codeInput: {
    borderWidth: 1.5, borderColor: colors.lave, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 22, fontWeight: '500',
    color: colors.ink, textAlign: 'center', letterSpacing: 3, marginBottom: 8,
  },
  codeHint: { fontSize: 11, color: colors.faint, textAlign: 'center', marginBottom: 16 },
  validateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.lave, borderRadius: 12, paddingVertical: 14,
  },
  validateBtnDisabled: { opacity: 0.5 },
  validateBtnText: { fontSize: 15, fontWeight: '500', color: '#FAF8F4' },
  resultCard: { borderRadius: 16, padding: 24, alignItems: 'center', gap: 10, borderWidth: 1 },
  resultSuccess: { backgroundColor: '#DCEEE3', borderColor: '#A8D5B5' },
  resultWarning: { backgroundColor: '#FAEEDA', borderColor: '#F0C070' },
  resultError: { backgroundColor: '#FFF0F0', borderColor: '#F5B5B5' },
  resultTitle: { fontSize: 18, fontWeight: '500' },
  resultText: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  resetBtn: {
    marginTop: 6, paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 10,
  },
  resetBtnText: { fontSize: 13, color: colors.ink, fontWeight: '500' },
  note: { backgroundColor: '#F5F4F0', borderRadius: 12, padding: 14 },
  noteText: { fontSize: 12, color: colors.muted, lineHeight: 18 },
});