export interface FileStore {
  read(path: string): string;
  write(path: string, content: string): void;
}
