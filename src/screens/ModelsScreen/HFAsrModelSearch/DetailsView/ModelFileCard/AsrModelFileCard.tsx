import React, {FC, useMemo, useContext} from 'react';
import {Alert, View} from 'react-native';

import {observer} from 'mobx-react';
import {Button, IconButton, Text} from 'react-native-paper';

import {useTheme} from '../../../../../hooks';
import {createStyles} from './styles';

import {asrModelStore} from '../../../../../store';
import {formatBytes, L10nContext} from '../../../../../utils';
import {HuggingFaceModel, ModelFile} from '../../../../../utils/types';

interface AsrModelFileCardProps {
  modelFile: ModelFile;
  hfModel: HuggingFaceModel;
}

export const AsrModelFileCard: FC<AsrModelFileCardProps> = observer(
  ({modelFile, hfModel}) => {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const l10n = useContext(L10nContext);

    const modelId = `${hfModel.id}/${modelFile.rfilename}`;
    const storeModel = asrModelStore.models.find(m => m.id === modelId);
    const isDownloading = storeModel
      ? asrModelStore.isDownloading(storeModel.id)
      : false;
    const downloadProgress = storeModel?.progress || 0;
    const downloadSpeed = storeModel?.downloadSpeed;
    const isDownloaded = Boolean(storeModel?.isDownloaded);

    const canDownload = modelFile.canFitInStorage !== false;

    const handleDownload = () => {
      if (!canDownload) {
        Alert.alert(
          l10n.models.modelFile.warnings.storage.shortMessage,
          l10n.models.modelFile.warnings.storage.message,
        );
        return;
      }
      asrModelStore.downloadHFModel(hfModel, modelFile);
    };

    const handleCancel = () => {
      if (storeModel && isDownloading) {
        asrModelStore.cancelDownload(storeModel.id);
      }
    };

    const handleDelete = () => {
      if (!storeModel || !storeModel.isDownloaded) {
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
              await asrModelStore.deleteModel(storeModel);
            },
          },
        ],
      );
    };

    // Show only filename portion
    const shortName = modelFile.rfilename.split('/').pop() || modelFile.rfilename;
    const sizeText = modelFile.size ? formatBytes(modelFile.size) : '';

    return (
      <View style={styles.container}>
        <View style={styles.topRow}>
          <Text variant="titleSmall" numberOfLines={1} ellipsizeMode="middle" style={styles.title}>
            {shortName}
          </Text>
          {isDownloaded ? (
            <IconButton
              icon="delete"
              onPress={handleDelete}
              accessibilityLabel="Delete ASR model"
            />
          ) : (
            <IconButton
              icon={canDownload ? 'download-outline' : 'download-off-outline'}
              onPress={handleDownload}
              disabled={!canDownload || isDownloading}
              accessibilityLabel="Download ASR model"
            />
          )}
        </View>

        {!!sizeText && <Text style={styles.subtitle}>{sizeText}</Text>}

        <View style={styles.actionsRow}>
          {isDownloading ? (
            <>
              <Text style={styles.progressText}>
                {Math.round(downloadProgress)}% {downloadSpeed ? `• ${downloadSpeed}` : ''}
              </Text>
              <Button mode="outlined" onPress={handleCancel}>
                {l10n.common.cancel}
              </Button>
            </>
          ) : isDownloaded ? (
            <Button
              mode="contained-tonal"
              onPress={() => asrModelStore.setActiveModel(storeModel!.id)}
            >
              {l10n.models.modelCard.buttons.load}
            </Button>
          ) : (
            <Button
              mode="contained"
              onPress={handleDownload}
              disabled={!canDownload}
            >
              {l10n.models.modelCard.buttons.download}
            </Button>
          )}
        </View>
      </View>
    );
  },
);

