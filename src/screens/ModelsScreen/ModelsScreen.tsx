import React, {useState, useContext, useEffect} from 'react';
import {FlatList, RefreshControl, Platform, Alert, View} from 'react-native';

import {reaction, computed} from 'mobx';
import {v4 as uuidv4} from 'uuid';
import 'react-native-get-random-values';
import {observer} from 'mobx-react-lite';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {pick, types} from '@react-native-documents/picker';
import {FAB, Portal, SegmentedButtons} from 'react-native-paper';

import {useTheme} from '../../hooks';

import {FABGroup} from './FABGroup';
import {ModelCard} from './ModelCard';
import {AsrModelCard} from './AsrModelCard';
import {createStyles} from './styles';
import {HFModelSearch} from './HFModelSearch';
import {HFAsrModelSearch} from './HFAsrModelSearch';
import {ModelAccordion} from './ModelAccordion';
import {
  DownloadErrorDialog,
  ErrorSnackbar,
  ModelSettingsSheet,
  ModelErrorReportSheet,
} from '../../components';

import {uiStore, modelStore, hfStore, hfAsrStore, asrModelStore, UIStore} from '../../store';

import {L10nContext} from '../../utils';
import {Model, ModelOrigin} from '../../utils/types';
import {ErrorState} from '../../utils/errors';

export const ModelsScreen: React.FC = observer(() => {
  const l10n = useContext(L10nContext);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [hfSearchVisible, setHFSearchVisible] = useState(false);
  const [hfAsrSearchVisible, setHFAsrSearchVisible] = useState(false);
  const [_, setTrigger] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<Model | undefined>();
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Centralized error state tracking - derive directly from MobX stores
  const [activeError, setActiveError] = useState<ErrorState | null>(null);
  const [isShowingErrorDialog, setIsShowingErrorDialog] = useState(false);

  // Model error report sheet state
  const [isErrorReportVisible, setIsErrorReportVisible] = useState(false);
  const [errorToReport, setErrorToReport] = useState<ErrorState | null>(null);

  const theme = useTheme();
  const styles = createStyles(theme);

  const filters = uiStore.pageStates.modelsScreen.filters;
  const expandedGroups = uiStore.pageStates.modelsScreen.expandedGroups;
  const modelCategory = uiStore.pageStates.modelsScreen.modelCategory || 'llm';

  // Set up MobX reactions to track store changes
  useEffect(() => {
    // Create a reaction for error handling
    const errorDisposer = reaction(
      // Track these observable values
      () => ({
        hfError: hfStore.error,
        hfAsrError: hfAsrStore.error,
        downloadError: modelStore.downloadError,
        asrDownloadError: asrModelStore.downloadError,
        modelLoadError: modelStore.modelLoadError,
        modelCategory: uiStore.pageStates.modelsScreen.modelCategory,
      }),
      // React to changes
      data => {
        const category = data.modelCategory || 'llm';

        if (category === 'asr') {
          // ASR: use snackbar only (no model-specific dialog)
          setIsShowingErrorDialog(false);
          if (data.hfAsrError) {
            setActiveError(data.hfAsrError);
          } else if (data.asrDownloadError) {
            setActiveError(data.asrDownloadError);
          } else {
            setActiveError(null);
          }
          return;
        }

        // LLM: First check if there's a download error that should show a dialog
        const hasDialogError =
          data.downloadError && data.downloadError.metadata?.modelId;

        setIsShowingErrorDialog(!!hasDialogError);

        // Then determine which error to show in the snackbar
        if (hasDialogError) {
          setActiveError(null);
        } else if (data.modelLoadError) {
          setActiveError(data.modelLoadError);
        } else if (data.hfError) {
          setActiveError(data.hfError);
        } else if (data.downloadError) {
          setActiveError(data.downloadError);
        } else {
          setActiveError(null);
        }
      },
    );

    // Clean up the reaction when component unmounts
    return () => {
      errorDisposer();
    };
  }, []); // Only run setup once

  const onRefresh = async () => {
    setRefreshing(true);
    if (modelCategory === 'asr') {
      await asrModelStore.refreshDownloadStatuses();
    } else {
      await modelStore.refreshDownloadStatuses();
    }
    setTrigger(prev => !prev);
    setRefreshing(false);
  };

  const handleOpenSettings = (model: Model) => {
    setSelectedModel(model);
    setSettingsVisible(true);
  };

  const handleCloseSettings = () => {
    setSettingsVisible(false);
    setSelectedModel(undefined);
  };

  const handleDismissError = () => {
    // Clear errors from all stores
    hfStore.clearError();
    hfAsrStore.clearError();
    modelStore.clearDownloadError();
    modelStore.clearModelLoadError();
    asrModelStore.clearDownloadError();
  };

  const handleRetryAction = () => {
    if (modelCategory === 'asr') {
      if (activeError?.context === 'search') {
        hfAsrStore.fetchModels();
      } else if (activeError?.context === 'download') {
        const modelId = activeError.metadata?.modelId;
        if (modelId) {
          asrModelStore.checkSpaceAndDownload(modelId).catch(() => {});
        }
      }
      handleDismissError();
      return;
    }

    if (activeError?.context === 'search') {
      hfStore.fetchModels();
    } else if (activeError?.context === 'download') {
      modelStore.retryDownload();
    } else if (activeError?.context === 'modelInit') {
      // Retry model initialization
      const modelId = activeError.metadata?.modelId;
      if (modelId) {
        const model = modelStore.models.find(m => m.id === modelId);
        if (model) {
          modelStore.initContext(model);
        }
      }
    }
    handleDismissError();
  };

  const handleReportModelError = () => {
    if (activeError?.context === 'modelInit') {
      setErrorToReport(activeError);
      setIsErrorReportVisible(true);
      handleDismissError();
    }
  };

  const handleCloseErrorReport = () => {
    setIsErrorReportVisible(false);
    setErrorToReport(null);
  };

  const handleAddLocalModel = async () => {
    pick({
      type: Platform.OS === 'ios' ? 'public.data' : types.allFiles,
    })
      .then(async res => {
        let [file] = res;
        if (file) {
          // Assign a default name if file.name is null or undefined
          // Not sure if this can ever happen, though.
          let fileName =
            file.name || file.uri.split('/').pop() || `file_${uuidv4()}`;

          const permanentDir = `${RNFS.DocumentDirectoryPath}/models/local`;
          let permanentPath = `${permanentDir}/${fileName}`;
          if (!(await RNFS.exists(permanentDir))) {
            await RNFS.mkdir(permanentDir);
          }

          if (await RNFS.exists(permanentPath)) {
            const choice = await new Promise<'replace' | 'keep' | 'cancel'>(
              resolve => {
                Alert.alert(
                  l10n.models.fileManagement.fileAlreadyExists,
                  l10n.models.fileManagement.fileAlreadyExistsMessage,
                  [
                    {
                      text: l10n.models.fileManagement.replace,
                      onPress: () => resolve('replace'),
                    },
                    {
                      text: l10n.models.fileManagement.keepBoth,
                      onPress: () => resolve('keep'),
                    },
                    {
                      text: l10n.common.cancel,
                      onPress: () => resolve('cancel'),
                      style: 'cancel',
                    },
                  ],
                );
              },
            );

            switch (choice) {
              case 'replace':
                await RNFS.unlink(permanentPath);
                break;
              case 'keep':
                let counter = 1;
                const nameParts = fileName.split('.');
                const ext = nameParts.length > 1 ? nameParts.pop() : '';
                const name = nameParts.join('.');
                do {
                  permanentPath = `${permanentDir}/${name}_${counter}.${ext}`;
                  counter++;
                } while (await RNFS.exists(permanentPath));
                break;
              case 'cancel':
                console.log('File copy cancelled by user');
                return;
            }
          }

          await RNFS.copyFile(file.uri, permanentPath);
          await modelStore.addLocalModel(permanentPath);
          setTrigger(prev => !prev);
        }
      })
      .catch(e => console.log('No file picked, error: ', e.message));
  };

  const handleAddLocalAsrModel = async () => {
    pick({
      type: Platform.OS === 'ios' ? 'public.data' : types.allFiles,
    })
      .then(async res => {
        const [file] = res;
        if (!file) return;
        let fileName =
          file.name || file.uri.split('/').pop() || `asr_${uuidv4()}.bin`;
        if (!fileName.toLowerCase().endsWith('.bin')) {
          fileName = fileName.replace(/\.[^.]+$/, '') + '.bin';
        }
        const permanentDir = `${RNFS.DocumentDirectoryPath}/models/asr/local`;
        let permanentPath = `${permanentDir}/${fileName}`;
        if (!(await RNFS.exists(permanentDir))) {
          await RNFS.mkdir(permanentDir, {recursive: true});
        }
        if (await RNFS.exists(permanentPath)) {
          const choice = await new Promise<'replace' | 'keep' | 'cancel'>(
            resolve => {
              Alert.alert(
                l10n.models.fileManagement.fileAlreadyExists,
                l10n.models.fileManagement.fileAlreadyExistsMessage,
                [
                  {text: l10n.models.fileManagement.replace, onPress: () => resolve('replace')},
                  {text: l10n.models.fileManagement.keepBoth, onPress: () => resolve('keep')},
                  {text: l10n.common.cancel, onPress: () => resolve('cancel'), style: 'cancel'},
                ],
              );
            },
          );
          if (choice === 'cancel') return;
          if (choice === 'replace') {
            await RNFS.unlink(permanentPath);
          } else {
            let counter = 1;
            const nameParts = fileName.split('.');
            const ext = nameParts.length > 1 ? nameParts.pop() : '';
            const base = nameParts.join('.');
            do {
              permanentPath = `${permanentDir}/${base}_${counter}.${ext}`;
              counter++;
            } while (await RNFS.exists(permanentPath));
          }
        }
        await RNFS.copyFile(file.uri, permanentPath);
        await asrModelStore.addLocalModel(permanentPath);
        setTrigger(prev => !prev);
      })
      .catch(e => console.log('No file picked, error: ', e.message));
  };

  const activeModelId = modelStore.activeModel?.id;
  const models = modelStore.displayModels;

  const asrModels = asrModelStore.models;

  // useMemo uses shallow comaprison for dependencies,
  // so we use computed instead for deep comparison
  // (model state changes not-downloaded -> downloaded)
  const filteredAndSortedModels = computed(() => {
    let result = models;
    if (filters.includes('downloaded')) {
      result = result.filter(model => model.isDownloaded);
    }
    if (!filters.includes('grouped')) {
      result = result.sort((a, b) => {
        if (a.isDownloaded && !b.isDownloaded) {
          return -1;
        }
        if (!a.isDownloaded && b.isDownloaded) {
          return 1;
        }
        return 0;
      });
    }
    if (filters.includes('hf')) {
      result = result.filter(model => model.origin === ModelOrigin.HF);
    }
    return result;
  }).get();

  const getGroupDisplayName = (key: string) => {
    switch (key) {
      case UIStore.GROUP_KEYS.READY_TO_USE:
        return l10n.models.labels.availableToUse;
      case UIStore.GROUP_KEYS.AVAILABLE_TO_DOWNLOAD:
        return l10n.models.labels.availableToDownload;
      default:
        return key;
    }
  };

  const groupedModels = computed(() => {
    if (!filters.includes('grouped')) {
      return {
        [UIStore.GROUP_KEYS.READY_TO_USE]: filteredAndSortedModels.filter(
          model => model.isDownloaded,
        ),
        [UIStore.GROUP_KEYS.AVAILABLE_TO_DOWNLOAD]:
          filteredAndSortedModels.filter(model => !model.isDownloaded),
      };
    }

    return filteredAndSortedModels.reduce(
      (acc, item) => {
        const groupKey =
          item.origin === ModelOrigin.LOCAL || item.isLocal
            ? l10n.models.labels.localModel
            : item.type || l10n.models.labels.unknownGroup;

        if (!acc[groupKey]) {
          acc[groupKey] = [];
        }
        acc[groupKey].push(item);
        return acc;
      },
      {} as Record<string, Model[]>,
    );
  }).get();

  const toggleGroup = (type: string) => {
    const currentExpandedGroups =
      uiStore.pageStates.modelsScreen.expandedGroups;
    const updatedExpandedGroups = {
      ...currentExpandedGroups,
      [type]: !currentExpandedGroups[type],
    };
    uiStore.setValue('modelsScreen', 'expandedGroups', updatedExpandedGroups);
  };

  const renderGroupHeader = ({item: group}) => {
    const isExpanded = expandedGroups[group.type];
    const displayName = filters.includes('grouped')
      ? group.type
      : getGroupDisplayName(group.type);
    const description =
      !filters.includes('grouped') &&
      group.type === UIStore.GROUP_KEYS.AVAILABLE_TO_DOWNLOAD
        ? l10n.models.labels.useAddButtonForMore
        : undefined;
    return (
      <ModelAccordion
        group={{...group, type: displayName}}
        expanded={isExpanded}
        description={description}
        onPress={() => toggleGroup(group.type)}>
        <FlatList
          data={group.items}
          keyExtractor={subItem => subItem.id}
          renderItem={({item: subItem}) => (
            <ModelCard
              model={subItem}
              activeModelId={activeModelId}
              onOpenSettings={() => handleOpenSettings(subItem)}
            />
          )}
        />
      </ModelAccordion>
    );
  };

  const flatListModels = Object.keys(groupedModels)
    .map(type => ({
      type,
      items: groupedModels[type],
    }))
    .filter(group => group.items.length > 0);

  const [asrExpandedGroups, setAsrExpandedGroups] = useState<Record<string, boolean>>({
    [UIStore.GROUP_KEYS.READY_TO_USE]: true,
    [UIStore.GROUP_KEYS.AVAILABLE_TO_DOWNLOAD]: true,
  });

  const groupedAsrModels = computed(() => {
    return {
      [UIStore.GROUP_KEYS.READY_TO_USE]: asrModels.filter(m => m.isDownloaded),
      [UIStore.GROUP_KEYS.AVAILABLE_TO_DOWNLOAD]: asrModels.filter(m => !m.isDownloaded),
    };
  }).get();

  const asrGroups = Object.keys(groupedAsrModels)
    .map(type => ({type, items: groupedAsrModels[type]}))
    .filter(group => group.items.length > 0);

  const toggleAsrGroup = (type: string) => {
    setAsrExpandedGroups(prev => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const renderAsrGroupHeader = ({item: group}) => {
    const isExpanded = asrExpandedGroups[group.type];
    const displayName =
      group.type === UIStore.GROUP_KEYS.READY_TO_USE
        ? l10n.models.labels.availableToUse
        : l10n.models.labels.availableToDownload;
    const description =
      group.type === UIStore.GROUP_KEYS.AVAILABLE_TO_DOWNLOAD
        ? l10n.models.labels.useAddButtonForMore
        : undefined;
    return (
      <ModelAccordion
        group={{...group, type: displayName}}
        expanded={isExpanded}
        description={description}
        onPress={() => toggleAsrGroup(group.type)}>
        <FlatList
          data={group.items}
          keyExtractor={subItem => subItem.id}
          renderItem={({item: subItem}) => (
            <AsrModelCard model={subItem} />
          )}
        />
      </ModelAccordion>
    );
  };

  return (
    <View style={styles.container} testID="models-screen">
      <View style={{paddingHorizontal: 16, paddingTop: 10}}>
        <SegmentedButtons
          value={modelCategory}
          onValueChange={value =>
            uiStore.setValue('modelsScreen', 'modelCategory', value)
          }
          buttons={[
            {value: 'llm', label: 'LLM'},
            {value: 'asr', label: 'ASR'},
          ]}
        />
      </View>
      {/* Show Error Snackbar only if no dialog is visible */}
      {!isShowingErrorDialog && activeError && (
        <ErrorSnackbar
          error={activeError}
          onDismiss={handleDismissError}
          onRetry={handleRetryAction}
          onReport={handleReportModelError}
        />
      )}

      {modelCategory === 'asr' ? (
        <FlatList
          testID="flat-list-asr"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContainer}
          data={asrGroups}
          keyExtractor={item => item.type}
          renderItem={renderAsrGroupHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.primary]}
            />
          }
        />
      ) : (
        <FlatList
          testID="flat-list"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContainer}
          data={flatListModels}
          keyExtractor={item => item.type}
          extraData={activeModelId}
          renderItem={renderGroupHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.primary]}
            />
          }
        />
      )}

      {/* DownloadErrorDialog with Portal for better visibility */}
      {modelCategory !== 'asr' && (
        <Portal>
          <DownloadErrorDialog
            visible={isShowingErrorDialog}
            onDismiss={() => {
              modelStore.clearDownloadError();
            }}
            error={modelStore.downloadError}
            model={
              modelStore.downloadError?.metadata?.modelId
                ? modelStore.models.find(
                    m => m.id === modelStore.downloadError?.metadata?.modelId,
                  )
                : undefined
            }
            onTryAgain={modelStore.retryDownload}
          />
        </Portal>
      )}

      <HFModelSearch
        visible={hfSearchVisible}
        onDismiss={() => setHFSearchVisible(false)}
      />
      <HFAsrModelSearch
        visible={hfAsrSearchVisible}
        onDismiss={() => setHFAsrSearchVisible(false)}
      />

      {modelCategory === 'asr' ? (
        <FABGroup
          onAddHFModel={() => setHFAsrSearchVisible(true)}
          onAddLocalModel={handleAddLocalAsrModel}
        />
      ) : (
        <FABGroup
          onAddHFModel={() => setHFSearchVisible(true)}
          onAddLocalModel={handleAddLocalModel}
        />
      )}
      <ModelSettingsSheet
        isVisible={settingsVisible}
        onClose={handleCloseSettings}
        model={selectedModel}
      />
      <ModelErrorReportSheet
        isVisible={isErrorReportVisible}
        onClose={handleCloseErrorReport}
        error={errorToReport}
      />
    </View>
  );
});
