import {makeAutoObservable, runInAction} from 'mobx';

import {fetchModelFilesDetails, fetchModels} from '../api/hf';
import {processHFAsrSearchResults} from '../utils/hf';
import {hasEnoughSpace} from '../utils';
import {ErrorState, createErrorState} from '../utils/errors';
import {HuggingFaceModel} from '../utils/types';

import {hfStore} from './HFStore';

// Filter types for enhanced search (shared shape with HFStore)
export type AsrSortOption = 'relevance' | 'downloads' | 'lastModified' | 'likes';

export interface AsrSearchFilters {
  author: string;
  sortBy: AsrSortOption;
}

class HFAsrStore {
  models: HuggingFaceModel[] = [];
  isLoading = false;
  error: ErrorState | null = null;
  nextPageLink: string | null = null;
  private lastFetchedNextLink: string | null = null;
  private lastFetchMoreAttempt: number = 0;
  private consecutiveSmallResults: number = 0;
  searchQuery = '';

  // Try to keep results relevant, but not overly restrictive
  queryFilter = 'automatic-speech-recognition,whisper';
  queryFull = true;
  queryConfig = true;

  // search filters
  searchFilters: AsrSearchFilters = {
    author: '',
    sortBy: 'relevance',
  };

  constructor() {
    makeAutoObservable(this);
  }

  clearError() {
    this.error = null;
  }

  setSearchQuery(query: string) {
    this.searchQuery = query;
  }

  setSearchFilters(filters: Partial<AsrSearchFilters>) {
    if (filters.author !== undefined) {
      this.searchFilters.author = filters.author;
    }
    if (filters.sortBy !== undefined) {
      this.searchFilters.sortBy = filters.sortBy;
    }
  }

  private shouldPreventFetchMore(): boolean {
    const now = Date.now();
    const timeSinceLastAttempt = now - this.lastFetchMoreAttempt;

    if (this.models.length < 5 && timeSinceLastAttempt < 2000) {
      return true;
    }
    if (this.consecutiveSmallResults >= 3 && timeSinceLastAttempt < 5000) {
      return true;
    }
    return false;
  }

  private getSortParams(): {sort: string; direction: string} | null {
    switch (this.searchFilters.sortBy) {
      case 'lastModified':
        return {sort: 'lastModified', direction: '-1'};
      case 'likes':
        return {sort: 'likes', direction: '-1'};
      case 'downloads':
        return {sort: 'downloads', direction: '-1'};
      case 'relevance':
      default:
        return null;
    }
  }

  private buildFilterString(): string {
    return this.queryFilter;
  }

  async fetchModels() {
    this.isLoading = true;
    this.error = null;

    this.lastFetchedNextLink = null;
    this.consecutiveSmallResults = 0;
    this.lastFetchMoreAttempt = 0;

    try {
      const sortParams = this.getSortParams();
      const authToken = hfStore.shouldUseToken ? hfStore.hfToken : null;

      const {models, nextLink} = await fetchModels({
        search: this.searchQuery,
        author: this.searchFilters.author || undefined,
        limit: 10,
        sort: sortParams?.sort,
        direction: sortParams?.direction,
        filter: this.buildFilterString(),
        full: this.queryFull,
        config: this.queryConfig,
        authToken,
      });

      const processedModels = processHFAsrSearchResults(models);
      runInAction(() => {
        this.models = processedModels;
        this.nextPageLink = nextLink;
      });
    } catch (error) {
      runInAction(() => {
        this.isLoading = false;
        this.nextPageLink = null;
        this.models = [];
      });
      runInAction(() => {
        this.error = createErrorState(error, 'search', 'huggingface');
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  async fetchMoreModels() {
    if (!this.nextPageLink || this.isLoading) {
      return;
    }

    if (this.shouldPreventFetchMore()) {
      return;
    }

    if (this.lastFetchedNextLink === this.nextPageLink) {
      return;
    }

    this.lastFetchedNextLink = this.nextPageLink;
    this.lastFetchMoreAttempt = Date.now();
    this.isLoading = true;
    this.error = null;

    try {
      const authToken = hfStore.shouldUseToken ? hfStore.hfToken : null;
      const {models, nextLink} = await fetchModels({
        nextPageUrl: this.nextPageLink,
        authToken,
      });

      const processedModels = processHFAsrSearchResults(models);

      runInAction(() => {
        if (processedModels.length < 3) {
          this.consecutiveSmallResults++;
        } else {
          this.consecutiveSmallResults = 0;
        }

        processedModels.forEach(m => this.models.push(m));
        this.nextPageLink = nextLink;
      });
    } catch (error) {
      runInAction(() => {
        this.error = createErrorState(error, 'search', 'huggingface');
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  getModelById(id: string): HuggingFaceModel | null {
    return this.models.find(model => model.id === id) || null;
  }

  private async updateSiblingsWithFileDetails(model: HuggingFaceModel, fileDetails: any[]) {
    return Promise.all(
      model.siblings.map(async file => {
        const details = fileDetails.find(detail => detail.path === file.rfilename);
        if (!details) {
          return {...file};
        }

        const enrichedFile = {
          ...file,
          size: details.size,
          oid: details.oid,
          lfs: details.lfs,
        };

        return {
          ...enrichedFile,
          canFitInStorage: await hasEnoughSpace({size: enrichedFile.size}),
        };
      }),
    );
  }

  async fetchModelFileDetails(modelId: string) {
    try {
      const authToken = hfStore.shouldUseToken ? hfStore.hfToken : null;
      const fileDetails = await fetchModelFilesDetails(modelId, authToken);
      const model = this.models.find(m => m.id === modelId);
      if (!model) {
        return;
      }

      const updatedSiblings = await this.updateSiblingsWithFileDetails(
        model,
        fileDetails,
      );

      runInAction(() => {
        model.siblings = updatedSiblings;
      });
    } catch (error) {
      runInAction(() => {
        this.error = createErrorState(error, 'modelDetails', 'huggingface');
      });
    }
  }

  async fetchModelData(modelId: string) {
    await this.fetchModelFileDetails(modelId);
  }
}

export const hfAsrStore = new HFAsrStore();

