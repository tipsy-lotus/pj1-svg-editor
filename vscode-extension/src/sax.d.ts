// sax 的窄接口适配声明：仅声明本扩展使用的 API；position 是 UTF-16 偏移。
declare module 'sax' {
  interface Tag {
    name: string;
    attributes: Record<string, string>;
  }
  interface SAXParser {
    position: number;
    startTagPosition: number;
    onopentag: ((tag: Tag) => void) | undefined;
    onclosetag: ((name: string) => void) | undefined;
    onerror: ((error: Error) => void) | undefined;
    write(source: string): SAXParser;
    close(): SAXParser;
  }
  export function parser(strict: boolean, options: { position: boolean; strictEntities: boolean }): SAXParser;
}
