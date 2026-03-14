import React, {useState} from 'react';
import {View, ScrollView} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Card, Text, Button, ActivityIndicator} from 'react-native-paper';

import {useTheme} from '../../hooks';
import {syncStore} from '../../store';

export const SyncScreen: React.FC = () => {
  const theme = useTheme();
  const [message, setMessage] = useState<string | null>(null);

  const handleSync = async () => {
    setMessage(null);
    const result = await syncStore.syncAll();
    if (result.success === 0 && result.failure === 0) {
      setMessage('Nothing to sync.');
    } else if (result.failure === 0) {
      setMessage(`Synced ${result.success} item(s).`);
    } else {
      setMessage(`Synced ${result.success} item(s), ${result.failure} failed (will retry).`);
    }
  };

  const pending = syncStore.pendingCount;
  const lastAt =
    syncStore.lastSyncedAt != null
      ? new Date(syncStore.lastSyncedAt).toLocaleString()
      : null;

  return (
    <SafeAreaView style={{flex: 1}} edges={['bottom']}>
      <ScrollView contentContainerStyle={{padding: 16}}>
        <Card elevation={0} style={{marginBottom: 16}}>
          <Card.Title title="Sync status" />
          <Card.Content>
            <Text variant="bodyLarge" style={{marginBottom: 8}}>
              Pending items: {pending}
            </Text>
            <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}}>
              Last sync:{' '}
              {lastAt ? lastAt : 'Not synced yet'}
            </Text>
            {message ? (
              <Text
                variant="bodySmall"
                style={{marginTop: 8, color: theme.colors.onSurface}}>
                {message}
              </Text>
            ) : null}
            <View style={{marginTop: 16, flexDirection: 'row', alignItems: 'center'}}>
              <Button
                mode="contained"
                onPress={handleSync}
                disabled={syncStore.isSyncing}>
                Sync now
              </Button>
              {syncStore.isSyncing && (
                <ActivityIndicator
                  style={{marginLeft: 12}}
                  size="small"
                  color={theme.colors.primary}
                />
              )}
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

