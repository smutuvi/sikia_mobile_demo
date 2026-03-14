import React, {useState, useContext, useCallback, useRef} from 'react';
import {TouchableOpacity, View} from 'react-native';

import {observer} from 'mobx-react';
import {Text, Button} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {BottomSheetFlatList} from '@gorhom/bottom-sheet';

import {Divider, EnhancedSearchBar, Sheet} from '../../../../components';
import {useTheme} from '../../../../hooks';
import {createStyles} from './styles';

import {hfAsrStore, hfStore} from '../../../../store';

import {HuggingFaceModel} from '../../../../utils/types';
import {extractHFModelTitle, formatNumber, timeAgo, L10nContext} from '../../../../utils';

interface SearchViewProps {
  testID?: string;
  onModelSelect: (model: HuggingFaceModel) => void;
  onChangeSearchQuery: (query: string) => void;
}

export const SearchView = observer(
  ({testID, onModelSelect, onChangeSearchQuery}: SearchViewProps) => {
    const theme = useTheme();
    const l10n = useContext(L10nContext);
    const styles = createStyles(theme);
    const [searchQuery, setSearchQuery] = useState('');
    const lastOnEndReachedCall = useRef<number>(0);

    const handleSearchChange = (query: string) => {
      setSearchQuery(query);
      onChangeSearchQuery(query);
    };

    const handleFiltersChange = useCallback(
      (newFilters: Partial<typeof hfAsrStore.searchFilters>) => {
        hfAsrStore.setSearchFilters(newFilters);
        hfAsrStore.fetchModels();
      },
      [],
    );

    const handleEndReached = useCallback(() => {
      const now = Date.now();
      const timeSinceLastCall = now - lastOnEndReachedCall.current;
      if (timeSinceLastCall < 1000) {
        return;
      }
      lastOnEndReachedCall.current = now;
      hfAsrStore.fetchMoreModels();
    }, []);

    const renderItem = ({item}: {item: HuggingFaceModel}) => {
      return (
        <TouchableOpacity
          key={item.id}
          onPress={() => onModelSelect(item)}
          accessible={true}
          accessibilityLabel={`${item.author} ${extractHFModelTitle(item.id)}`}
          testID={`hf-asr-model-item-${item.id}`}>
          <Text variant="labelMedium" style={styles.modelAuthor}>
            {item.author}
          </Text>
          <View style={styles.modelNameContainer}>
            <Text style={styles.modelName}>{extractHFModelTitle(item.id)}</Text>
          </View>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Icon
                name="clock-outline"
                size={12}
                color={theme.colors.onSurfaceVariant}
              />
              <Text variant="labelSmall" style={styles.statText}>
                {timeAgo(item.lastModified, l10n, 'short')}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Icon
                name="download-outline"
                size={12}
                color={theme.colors.onSurfaceVariant}
              />
              <Text variant="labelSmall" style={styles.statText}>
                {formatNumber(item.downloads)}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Icon
                name="heart-outline"
                size={12}
                color={theme.colors.onSurfaceVariant}
              />
              <Text variant="labelSmall" style={styles.statText}>
                {formatNumber(item.likes)}
              </Text>
            </View>
          </View>
          <Divider style={styles.divider} />
        </TouchableOpacity>
      );
    };

    const renderEmptyState = observer(() => {
      if (hfAsrStore.isLoading) {
        return null;
      }

      if (hfAsrStore.error) {
        return (
          <View style={styles.emptyStateContainer}>
            <Icon
              name="alert-circle-outline"
              size={24}
              color={theme.colors.onSurfaceVariant}
            />
            <Text style={styles.noResultsText}>{l10n.models.search.errorOccurred}</Text>
            <Text style={styles.errorText}>{hfAsrStore.error.message}</Text>
            {hfAsrStore.error.code === 'authentication' &&
              hfAsrStore.error.context === 'search' && (
                <Text style={styles.errorHintText}>
                  {l10n.components.hfTokenSheet.searchErrorHint}
                </Text>
              )}
            {hfAsrStore.error.code === 'authentication' &&
              hfAsrStore.error.context === 'search' && (
              <Button
                mode="outlined"
                style={styles.disableTokenButton}
                onPress={() => {
                  // Reuse the global HF token preference (hfStore)
                  // by toggling it off for the main store.
                  // This affects ASR search too.
                  hfStore.setUseHfToken(false);
                  hfAsrStore.clearError();
                  hfAsrStore.fetchModels();
                }}>
                {l10n.components.hfTokenSheet.disableAndRetry}
              </Button>
            )}
          </View>
        );
      }

      if (searchQuery.length > 0) {
        return <Text style={styles.noResultsText}>{l10n.models.search.noResults}</Text>;
      }

      return null;
    });

    return (
      <View style={styles.contentContainer} testID={testID}>
        <EnhancedSearchBar
          value={searchQuery}
          onChangeText={handleSearchChange}
          placeholder={l10n.models.search.searchPlaceholder}
          filters={hfAsrStore.searchFilters}
          onFiltersChange={filters => {
            handleFiltersChange(filters);
          }}
          testID="enhanced-search-bar-asr"
        />
        <BottomSheetFlatList
          data={hfAsrStore.models}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={renderEmptyState}
          renderScrollComponent={props => (
            <Sheet.ScrollView bottomOffset={100} {...props} />
          )}
          keyboardShouldPersistTaps="handled"
        />
      </View>
    );
  },
);

