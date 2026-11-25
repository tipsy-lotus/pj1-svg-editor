import type { PluginContext } from './PluginContext.js';

export interface Plugin {
  activate(context: PluginContext, options?: unknown): void | Promise<void>;
}
