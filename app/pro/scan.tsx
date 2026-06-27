import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  Platform, ActivityIndicator,
} from 'react-native';
import { QrCode, CheckCircle, XCircle, Search } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { colors } from '../../lib/theme';

type ScanResult = {
  success: boolean;
  alreadyUsed?: boolean;
  usedAt?: string;
  bookingId?: string;
  name?: string;
  details?: string;
} | null;

export default function ScanScreen() {
  const { profile } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult>(null);

  async function handleValidate() {
    if (!code.trim() || !profile?.id) return;
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.rpc('validate_ticket', {
        p_code: code.trim().toUpperCase(),
        p_validator: profile.id,
      });

      if (error) {
        setResult({ success: false });
      } else if (data && data.length > 0) {
        const row = data[0];
        setResult({
          success: true,
          alreadyUsed: row.already_used,
          usedAt: row.used_at,
          bookingId: row.booking_id,
        });
      } else {
        setResult({ success: false });
      }
    } catch {
      setResult({ success: false });
    }

    setLoading(false);
  }

  function handleReset() {
    setCode('');
    setResult(null);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scanner un ticket</Text>
        <Text style={styles.headerSub}>Entrez le code du ticket du client</Text>
      </View>

      <View style={styles.content}>
        {/* Zone de saisie du code */}
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
            onPress={handleValidate}
            disabled={!code.trim() || loading}
          >
            {loading
              ? <ActivityIndicator color="#FAF8F4" />
              : <><Search size={16} color="#FAF8F4" /><Text style={styles.validateBtnText}>Valider le ticket</Text></>
            }
          </Pressable>
        </View>

        {/* Résultat */}
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
                <Text style={styles.resultText}>
                  Le client est enregistré. Ce code est maintenant invalidé.
                </Text>
                <Pressable style={styles.resetBtn} onPress={handleReset}>
                  <Text style={styles.resetBtnText}>Scanner un autre ticket</Text>
                </Pressable>
              </>
            ) : result.success && result.alreadyUsed ? (
              <>
                <XCircle size={40} color="#854F0B" />
                <Text style={[styles.resultTitle, { color: '#854F0B' }]}>⚠️ Ticket déjà utilisé</Text>
                <Text style={styles.resultText}>
                  Ce code a déjà été scanné.
                  {result.usedAt ? `\n(${new Date(result.usedAt).toLocaleString('fr-FR')})` : ''}
                </Text>
                <Pressable style={styles.resetBtn} onPress={handleReset}>
                  <Text style={styles.resetBtnText}>Réessayer</Text>
                </Pressable>
              </>
            ) : (
              <>
                <XCircle size={40} color="#C0392B" />
                <Text style={[styles.resultTitle, { color: '#C0392B' }]}>❌ Code invalide</Text>
                <Text style={styles.resultText}>
                  Ce code n'existe pas ou n'appartient pas à votre établissement.
                </Text>
                <Pressable style={styles.resetBtn} onPress={handleReset}>
                  <Text style={styles.resetBtnText}>Réessayer</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {/* Note */}
        <View style={styles.note}>
          <Text style={styles.noteText}>
            💡 Le client peut vous montrer son code sur son téléphone ou vous le lire à voix haute. Chaque code ne peut être validé qu'une seule fois.
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
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: { fontSize: 20, fontWeight: '500', color: '#FAF8F4' },
  headerSub: { fontSize: 13, color: 'rgba(250,248,244,0.7)', marginTop: 4 },
  content: { padding: 16, gap: 16 },
  codeCard: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, padding: 20,
  },
  codeLabel: { fontSize: 13, fontWeight: '500', color: colors.ink, marginBottom: 8 },
  codeInput: {
    borderWidth: 1.5, borderColor: colors.lave, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 22, fontWeight: '500', color: colors.ink,
    textAlign: 'center', letterSpacing: 3,
    marginBottom: 8,
  },
  codeHint: { fontSize: 11, color: colors.faint, textAlign: 'center', marginBottom: 16 },
  validateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.lave,
    borderRadius: 12, paddingVertical: 14,
  },
  validateBtnDisabled: { opacity: 0.5 },
  validateBtnText: { fontSize: 15, fontWeight: '500', color: '#FAF8F4' },
  resultCard: {
    borderRadius: 16, padding: 24,
    alignItems: 'center', gap: 10,
    borderWidth: 1,
  },
  resultSuccess: { backgroundColor: '#DCEEE3', borderColor: '#A8D5B5' },
  resultWarning: { backgroundColor: '#FAEEDA', borderColor: '#F0C070' },
  resultError: { backgroundColor: '#FFF0F0', borderColor: '#F5B5B5' },
  resultTitle: { fontSize: 18, fontWeight: '500' },
  resultText: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  resetBtn: {
    marginTop: 6, paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.borderStrong,
    borderRadius: 10,
  },
  resetBtnText: { fontSize: 13, color: colors.ink, fontWeight: '500' },
  note: {
    backgroundColor: '#F5F4F0', borderRadius: 12, padding: 14,
  },
  noteText: { fontSize: 12, color: colors.muted, lineHeight: 18 },
});