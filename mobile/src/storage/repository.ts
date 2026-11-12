import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { createRepository } from './repositoryCore';
import { createRepositoryIo } from './repositoryIo';

export type { SealInput } from './repositoryCore';

/**
 * App repository: the logic lives in repositoryCore and the call mapping in
 * repositoryIo (both testable without React Native); this module only passes
 * the real AsyncStorage and expo-file-system modules.
 */
const repo = createRepository(createRepositoryIo(AsyncStorage, FileSystem));

export const {
  getCardsDir,
  loadSnapshot,
  getSettings,
  updateSettings,
  listBinders,
  createBinder,
  renameBinder,
  deleteBinder,
  listCards,
  getCard,
  getBinder,
  binderNameAfterWrites,
  countCardsInBinder,
  latestThumbInBinder,
  sealCard,
  moveCard,
  destroyCard,
  resolveWidgetCard,
} = repo;
