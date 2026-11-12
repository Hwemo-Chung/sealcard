import type { RepositoryIo } from './repositoryCore';

/** The AsyncStorage calls the repository makes (the default export satisfies it). */
export type AsyncStorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

/** The expo-file-system/legacy calls the repository makes (the module namespace satisfies it). */
export type FileSystemLike = {
  documentDirectory: string | null;
  getInfoAsync(uri: string): Promise<{ exists: boolean }>;
  makeDirectoryAsync(uri: string, options: { intermediates: boolean }): Promise<void>;
  copyAsync(options: { from: string; to: string }): Promise<void>;
  deleteAsync(uri: string, options: { idempotent: boolean }): Promise<void>;
};

/**
 * RepositoryIo over AsyncStorage and expo-file-system (repository.ts passes the
 * real modules). Kept free of React Native imports so the binding is tested.
 */
export function createRepositoryIo(storage: AsyncStorageLike, fs: FileSystemLike): RepositoryIo {
  return {
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => storage.setItem(key, value),
    documentDirectory: () => fs.documentDirectory,
    exists: async (uri) => (await fs.getInfoAsync(uri)).exists,
    makeDirectory: (uri) => fs.makeDirectoryAsync(uri, { intermediates: true }),
    copy: (from, to) => fs.copyAsync({ from, to }),
    remove: (uri) => fs.deleteAsync(uri, { idempotent: true }),
  };
}
