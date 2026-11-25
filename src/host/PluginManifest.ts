export interface PluginManifest {
  readonly name: string;
  readonly contributes?: {
    readonly shapes?: readonly string[];
    readonly commands?: readonly string[];
    readonly attributes?: readonly string[];
    readonly decorators?: readonly string[];
  };
}
