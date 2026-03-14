import React, {useState, useCallback, useMemo, useEffect} from 'react';

import {observer} from 'mobx-react';
import debounce from 'lodash/debounce';

import {SearchView} from './SearchView';
import {DetailsView} from './DetailsView';

import {hfAsrStore} from '../../../store';

import {HuggingFaceModel} from '../../../utils/types';
import {Sheet} from '../../../components';

interface HFAsrModelSearchProps {
  visible: boolean;
  onDismiss: () => void;
}

const DEBOUNCE_DELAY = 500;

export const HFAsrModelSearch: React.FC<HFAsrModelSearchProps> = observer(
  ({visible, onDismiss}) => {
    const [detailsVisible, setDetailsVisible] = useState(false);
    const [selectedModel, setSelectedModel] = useState<HuggingFaceModel | null>(
      null,
    );

    // Clear state when closed
    useEffect(() => {
      if (!visible) {
        setSelectedModel(null);
      }
    }, [visible]);

    const debouncedSearch = useMemo(
      () =>
        debounce(async (query: string) => {
          hfAsrStore.setSearchQuery(query);
          await hfAsrStore.fetchModels();
        }, DEBOUNCE_DELAY),
      [],
    );

    const handleSearchChange = useCallback(
      (query: string) => {
        debouncedSearch(query);
      },
      [debouncedSearch],
    );

    useEffect(() => {
      if (visible) {
        handleSearchChange(hfAsrStore.searchQuery);
      }
    }, [handleSearchChange, visible]);

    const handleModelSelect = async (model: HuggingFaceModel) => {
      setSelectedModel(model);
      setDetailsVisible(true);
      await hfAsrStore.fetchModelData(model.id);
      const updatedModel = hfAsrStore.getModelById(model.id);
      if (updatedModel) {
        setSelectedModel({...updatedModel});
      }
    };

    const handleSheetDismiss = () => {
      hfAsrStore.clearError();
      onDismiss();
    };

    return (
      <>
        <Sheet
          isVisible={visible}
          snapPoints={['92%']}
          enableDynamicSizing={false}
          enablePanDownToClose
          enableContentPanningGesture={false}
          onClose={handleSheetDismiss}
          showCloseButton={true}>
          <SearchView
            testID="hf-asr-model-search-view"
            onModelSelect={handleModelSelect}
            onChangeSearchQuery={handleSearchChange}
          />
        </Sheet>
        <Sheet
          isVisible={detailsVisible}
          snapPoints={['90%']}
          enableDynamicSizing={false}
          enablePanDownToClose
          enableContentPanningGesture={false}
          onClose={() => setDetailsVisible(false)}
          showCloseButton={false}>
          {selectedModel && <DetailsView hfModel={selectedModel} />}
        </Sheet>
      </>
    );
  },
);

