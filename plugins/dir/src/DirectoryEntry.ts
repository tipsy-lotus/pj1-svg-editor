export interface DirectoryEntry {
  readonly name: string;
  readonly kind: 'directory' | 'file' | 'link' | 'other';
}
