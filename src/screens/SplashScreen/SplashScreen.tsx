import React, {useEffect} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import {ActivityIndicator} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';

import {sikiaAuthService} from '../../services/sikiaAuth';

const SIKIA_PRIMARY_GREEN = '#2E7D32';
const SIKIA_LIGHT_BG = '#E8F5E9';

function getRequireLogin(): boolean {
  try {
    const Config = require('react-native-config').default;
    const raw = Config?.ENABLE_AUTHENTICATION;
    return raw === 'true' || raw === true;
  } catch {
    return false;
  }
}

export const SplashScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const requireLogin = getRequireLogin();
  const isAuthenticated = requireLogin ? sikiaAuthService.isAuthenticated : true;

  useEffect(() => {
    const timer = setTimeout(() => {
      const shouldGate = requireLogin;
      if (shouldGate && !isAuthenticated) {
        navigation.reset({
          index: 0,
          routes: [{name: 'Login'}],
        });
      } else {
        navigation.reset({
          index: 0,
          routes: [{name: 'Main'}],
        });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [navigation, requireLogin, isAuthenticated]);

  return (
    <View style={styles.container}>
      <View style={styles.logoCircle}>
        <MaterialIcon name="hearing" size={64} color={SIKIA_PRIMARY_GREEN} />
      </View>
      <Text style={styles.title}>Sikia</Text>
      <Text style={styles.tagline}>Offline-first farmer feedback</Text>
      <View style={styles.loader}>
        <ActivityIndicator
          size="small"
          color={SIKIA_PRIMARY_GREEN}
          style={{opacity: 0.7}}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SIKIA_LIGHT_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${SIKIA_PRIMARY_GREEN}1F`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 52,
    fontWeight: '700',
    color: SIKIA_PRIMARY_GREEN,
    letterSpacing: 4,
    marginTop: 32,
  },
  tagline: {
    fontSize: 16,
    color: `${SIKIA_PRIMARY_GREEN}BF`,
    letterSpacing: 1.5,
    marginTop: 12,
  },
  loader: {
    marginTop: 64,
  },
});
