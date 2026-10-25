import type { Command } from '../commands/Command.js';
import { History } from '../commands/History.js';
import { SvgFileRepository } from '../io/SvgFileRepository.js';
import { SvgDocument } from '../model/SvgDocument.js';

export class EditorSession {
  private current?: SvgDocument;
  private readPath?: string;
  private readonly history = new History();

  constructor(private readonly repository: SvgFileRepository) {}

  get document(): SvgDocument {
    if (!this.current) throw new Error("no document. use 'init' or 'read' first");
    return this.current;
  }

  get currentPath(): string | undefined { return this.readPath; }

  init(width = 800, height = 600): string {
    const document = new SvgDocument(width, height);
    this.current = document; this.readPath = undefined; this.history.barrier();
    return `canvas ${document.width}x${document.height} created`;
  }

  read(path: string): readonly string[] {
    const { document, warnings } = this.repository.read(path);
    this.current = document; this.readPath = path; this.history.barrier();
    return [...warnings, `read ${path} (${document.all().length} elements)`];
  }

  save(path?: string): string {
    const document = this.document;
    const target = path ?? this.readPath;
    if (target === undefined) throw new Error("no read path. specify 'save <file.svg>'");
    this.repository.save(document, target);
    this.history.barrier();
    return `saved to ${target} (${document.all().length} elements)`;
  }

  canvas(width?: number, height?: number): string {
    const document = this.document;
    if (width === undefined && height === undefined) return `canvas ${document.width}x${document.height}`;
    if (width === undefined || height === undefined) throw new Error('usage: canvas [w h]');
    document.resize(width, height); this.history.barrier();
    return `canvas resized to ${document.width}x${document.height}`;
  }

  execute(command: Command): string { return this.history.execute(command, this.document); }
  undo(): string { return this.history.undo(this.document); }
  redo(): string { return this.history.redo(this.document); }
}
