import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import {TextInput, Button} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {observer} from 'mobx-react';

import {sikiaAuthService, getSikiaAuthBaseUrl} from '../../services/sikiaAuth';
import {prefetchProjects} from '../../services/mobileApi';

const SIKIA_PRIMARY_GREEN = '#2E7D32';
const SIKIA_LIGHT_BG = '#E8F5E9';

export const LoginScreen: React.FC = observer(() => {
  const navigation = useNavigation<any>();
  const [enumId, setEnumId] = useState('');
  const [password, setPassword] = useState('');
  const [obscurePassword, setObscurePassword] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  const isLoading = sikiaAuthService.isLoading;
  const error = sikiaAuthService.error ?? validationError;

  const handleSignIn = async () => {
    const trimmed = enumId.trim();
    setValidationError(null);
    sikiaAuthService.clearError();
    if (!trimmed || !password) {
      setValidationError('Enter enumerator ID and password');
      return;
    }
    try {
      await sikiaAuthService.login(trimmed, password);
      // Navigate immediately — do not block on anything else.
      navigation.reset({index: 0, routes: [{name: 'Main'}]});
      // Fire prefetch in parallel with navigator initialising.
      // getIdToken() reads a cached value after login so it is near-instant,
      // but we still don't await it before navigation.
      sikiaAuthService.getIdToken().then(token => {
        if (token) {
          prefetchProjects({
            baseUrl: getSikiaAuthBaseUrl().replace(/\/$/, ''),
            token,
          });
        }
      });
    } catch {
      // Error already set on sikiaAuthService
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.logoCircle}>
          <MaterialIcon name="hearing" size={64} color={SIKIA_PRIMARY_GREEN} />
        </View>
        <Text style={styles.title}>Sikia</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        <TextInput
          label="Enumerator ID"
          placeholder="e.g. jmedici"
          value={enumId}
          onChangeText={setEnumId}
          mode="outlined"
          autoCapitalize="none"
          autoCorrect={false}
          disabled={isLoading}
          style={styles.input}
          outlineColor={SIKIA_PRIMARY_GREEN}
          activeOutlineColor={SIKIA_PRIMARY_GREEN}
          left={<TextInput.Icon icon="account-outline" size={20} />}
        />
        <TextInput
          label="Password"
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          mode="outlined"
          secureTextEntry={obscurePassword}
          disabled={isLoading}
          style={styles.input}
          outlineColor={SIKIA_PRIMARY_GREEN}
          activeOutlineColor={SIKIA_PRIMARY_GREEN}
          left={<TextInput.Icon icon="lock-outline" size={20} />}
          right={
            <TextInput.Icon
              icon={obscurePassword ? 'eye-off-outline' : 'eye-outline'}
              onPress={() => setObscurePassword(!obscurePassword)}
            />
          }
        />
        {error ? (
          <Text style={styles.errorText} numberOfLines={3}>
            {error}
          </Text>
        ) : null}
        <Button
          mode="contained"
          onPress={handleSignIn}
          loading={isLoading}
          disabled={isLoading}
          style={styles.button}
          buttonColor={SIKIA_PRIMARY_GREEN}>
          Sign in
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SIKIA_LIGHT_BG,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: `${SIKIA_PRIMARY_GREEN}1F`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: SIKIA_PRIMARY_GREEN,
    letterSpacing: 2,
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: `${SIKIA_PRIMARY_GREEN}BF`,
    marginTop: 8,
    marginBottom: 32,
  },
  input: {
    width: '100%',
    backgroundColor: 'transparent',
    marginBottom: 16,
  },
  errorText: {
    width: '100%',
    fontSize: 14,
    color: '#B00020',
    textAlign: 'center',
    marginBottom: 8,
  },
  button: {
    width: '100%',
    marginTop: 8,
  },
});
