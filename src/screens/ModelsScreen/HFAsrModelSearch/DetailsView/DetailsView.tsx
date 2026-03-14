import React, {useContext} from 'react';
import {View} from 'react-native';

import {Text, Chip, Tooltip} from 'react-native-paper';
import {BottomSheetFlatList} from '@gorhom/bottom-sheet';

import {Sheet} from '../../../../components';
import {useTheme} from '../../../../hooks';

import {createStyles} from './styles';
import {AsrModelFileCard} from './ModelFileCard';

import {HuggingFaceModel, ModelFile} from '../../../../utils/types';
import {extractHFModelTitle, formatNumber, L10nContext, timeAgo} from '../../../../utils';

interface DetailsViewProps {
  hfModel: HuggingFaceModel;
}

export const DetailsView = ({hfModel}: DetailsViewProps) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const l10n = useContext(L10nContext);

  const renderItem = ({item}: {item: ModelFile}) => (
    <AsrModelFileCard key={item.rfilename} modelFile={item} hfModel={hfModel} />
  );

  return (
    <View style={styles.content}>
      <View style={styles.header}>
        <View style={styles.authorRow}>
          <Text variant="headlineSmall" style={styles.modelAuthor}>
            {hfModel.author}
          </Text>
        </View>
        <View style={styles.titleContainer}>
          <Tooltip title={hfModel.id}>
            <Text
              ellipsizeMode="middle"
              numberOfLines={1}
              variant="headlineSmall"
              style={styles.modelTitle}>
              {extractHFModelTitle(hfModel.id)}
            </Text>
          </Tooltip>
        </View>
        <View style={styles.modelStats}>
          <Chip
            icon="clock"
            compact
            style={styles.stat}
            textStyle={styles.statText}
            mode="outlined">
            {timeAgo(hfModel.lastModified, l10n, 'long')}
          </Chip>
          <Chip
            icon="download"
            compact
            style={styles.stat}
            textStyle={styles.statText}
            mode="outlined">
            {formatNumber(hfModel.downloads, 0)}
          </Chip>
          <Chip
            icon="heart"
            compact
            style={styles.stat}
            textStyle={styles.statText}
            mode="outlined">
            {formatNumber(hfModel.likes, 0)}
          </Chip>
        </View>
        <Text variant="titleLarge" style={styles.sectionTitle}>
          {l10n.models.details.title}
        </Text>
      </View>
      <BottomSheetFlatList
        data={hfModel.siblings || []}
        keyExtractor={(item: ModelFile) => item.rfilename}
        renderItem={renderItem}
        renderScrollComponent={props => (
          <Sheet.ScrollView bottomOffset={100} {...props} />
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

