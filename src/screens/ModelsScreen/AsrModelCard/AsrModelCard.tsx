import React, {useContext, useMemo} from 'react';
import {Alert, View} from 'react-native';

import {observer} from 'mobx-react-lite';
import {Button, Card, IconButton, Text} from 'react-native-paper';

import {useTheme} from '../../../hooks';
import {createStyles} from './styles';

import {asrModelStore} from '../../../store';
import {formatBytes, L10nContext} from '../../../utils';
import {AsrModel, AsrModelOrigin} from '../../../utils/types';

type Props = {
  model: AsrModel;
};

export const AsrModelCard: React.FC<Props> = observer(({model}) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const l10n = useContext(L10nContext);

  const isActive = asrModelStore.activeModelId === model.id;
  const isDownloading = asrModelStore.isDownloading(model.id);
  const progress = model.progress || 0;

  const sizeText = model.size ? formatBytes(model.size) : l10n.models.modelDescription.notAvailable;

  const canDelete = (model.origin === AsrModelOrigin.HF || model.origin === AsrModelOrigin.LOCAL) && model.isDownloaded;

  const handlePrimary = () => {
    if (isActive) {
      asrModelStore.setActiveModel(undefined);
      return;
    }
    if (model.isDownloaded) {
      asrModelStore.setActiveModel(model.id);
      return;
    }
    if (model.origin === AsrModelOrigin.HF && model.downloadUrl) {
      asrModelStore.checkSpaceAndDownload(model.id).catch(() => {});
      return;
    }
    if (model.origin === AsrModelOrigin.HF && model.hfUrl) {
      Alert.alert(
        'Add from Hugging Face',
        l10n.models.labels.useAddButtonForMore,
      );
    }
  };

  const handleCancel = () => {
    asrModelStore.cancelDownload(model.id);
  };

  const handleDelete = () => {
    if (!canDelete || !model.isDownloaded) {
      return;
    }
    Alert.alert(
      l10n.models.modelFile.alerts.deleteTitle,
      l10n.models.modelFile.alerts.deleteMessage,
      [
        {text: l10n.common.cancel, style: 'cancel'},
        {
          text: l10n.common.delete,
          onPress: async () => {
            await asrModelStore.deleteModel(model);
          },
        },
      ],
    );
  };

  const primaryLabel = isActive
    ? l10n.models.modelCard.buttons.offload
    : model.isDownloaded
      ? l10n.models.modelCard.buttons.load
      : l10n.models.modelCard.buttons.download;

  const getButtonStyle = () => {
    if (isActive) {
      return {
        backgroundColor: theme.colors.btnReadyBg,
        borderColor: theme.colors.btnReadyBorder,
      };
    }
    if (model.isDownloaded) {
      return {
        backgroundColor: theme.colors.btnPrimaryBg,
        borderColor: theme.colors.btnPrimaryBorder,
      };
    }
    return {
      backgroundColor: theme.colors.btnDownloadBg,
      borderColor: theme.colors.btnDownloadBorder,
    };
  };

  const getButtonTextColor = () => {
    if (isActive) return theme.colors.btnReadyText;
    if (model.isDownloaded) return theme.colors.btnPrimaryText;
    return theme.colors.btnDownloadText;
  };

  return (
    <Card elevation={0} style={styles.card} testID={`asr-model-card-${model.filename}`}>
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <Text variant="titleSmall" numberOfLines={1} ellipsizeMode="middle">
            {model.name}
          </Text>
          <Text variant="labelSmall" style={styles.subtitle}>
            {sizeText}
          </Text>
        </View>
        {canDelete && model.isDownloaded && (
          <IconButton icon="delete" onPress={handleDelete} accessibilityLabel="Delete ASR model" />
        )}
      </View>

      <View style={styles.actionsRow}>
        {isDownloading ? (
          <>
            <Text variant="labelSmall" style={styles.progressText}>
              {Math.round(progress)}% {model.downloadSpeed ? `• ${model.downloadSpeed}` : ''}
            </Text>
            <Button mode="outlined" onPress={handleCancel}>
              {l10n.common.cancel}
            </Button>
          </>
        ) : (
          <Button
            mode="outlined"
            icon={isActive ? 'eject' : 'play-circle-outline'}
            onPress={handlePrimary}
            style={[styles.primaryActionButton, getButtonStyle()]}
            textColor={getButtonTextColor()}>
            {primaryLabel}
          </Button>
        )}
      </View>
    </Card>
  );
});

