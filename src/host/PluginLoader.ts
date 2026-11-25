import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import type { Plugin } from '../extensions/Plugin.js';
import type { PluginManifest } from './PluginManifest.js';
import type { PluginHost } from './PluginHost.js';

interface PluginEntry { module: string; enabled?: boolean; options?: unknown; }

/** 只处理通用配置与模块加载，不认识任何具体插件。 */
export class PluginLoader {
  constructor(private readonly host: PluginHost) {}

  async load(configPath: string): Promise<readonly string[]> {
    const configFile = resolve(configPath);
    let entries: PluginEntry[];
    try {
      const config: unknown = JSON.parse(readFileSync(configFile, 'utf8'));
      if (!this.record(config) || !Array.isArray(config.plugins)) throw new Error('config');
      entries = config.plugins.map((entry: unknown) => {
        if (!this.record(entry) || typeof entry.module !== 'string' || !entry.module.trim()
          || (entry.enabled !== undefined && typeof entry.enabled !== 'boolean')) throw new Error('config');
        return entry as unknown as PluginEntry;
      });
    } catch { return ['error: invalid plugin config']; }
    const errors: string[] = [];
    for (const entry of entries) {
      if (entry.enabled === false) continue;
      errors.push(...await this.loadOne(entry, configFile));
    }
    return errors;
  }

  private async loadOne(entry: PluginEntry, configFile: string): Promise<readonly string[]> {
    const request = createRequire(pathToFileURL(configFile));
    const local = isAbsolute(entry.module) || entry.module.startsWith('.');
    const target = local ? resolve(dirname(configFile), entry.module) : entry.module;
    let moduleFile: string;
    let manifestFile: string | undefined;
    try {
      if (local) {
        if (!existsSync(target)) return [`error: plugin not found: ${entry.module}`];
        if (statSync(target).isDirectory()) manifestFile = join(target, 'package.json');
      }
      moduleFile = request.resolve(target);
    } catch (error) {
      const packageName = entry.module.startsWith('@') ? entry.module.split('/').slice(0, 2).join('/') : entry.module.split('/')[0]!;
      const packageExists = !local && (request.resolve.paths(entry.module) ?? []).some(base => existsSync(join(base, packageName)));
      if (!local && !packageExists && this.record(error) && error.code === 'MODULE_NOT_FOUND') return [`error: plugin not found: ${entry.module}`];
      return [this.failed(entry.module, error)];
    }
    let name = entry.module;
    try {
      if (!manifestFile) manifestFile = this.findManifest(moduleFile);
      const manifest: unknown = JSON.parse(readFileSync(manifestFile, 'utf8'));
      if (!this.record(manifest) || typeof manifest.name !== 'string' || !manifest.name.trim()) throw new Error('invalid plugin manifest');
      name = manifest.name;
      // 顶层模块已成功解析；从这里起的依赖缺失或求值错误均属于加载失败。
      const namespace: Record<string, unknown> = await import(pathToFileURL(moduleFile).href);
      if (!Object.hasOwn(namespace, 'default')) return [`error: plugin has no default export: ${entry.module}`];
      const plugin = namespace.default;
      if (!this.record(plugin) || typeof plugin.activate !== 'function') throw new Error('default export must provide activate');
      return await this.host.activate(plugin as unknown as Plugin, manifest as unknown as PluginManifest, entry.options);
    } catch (error) { return [this.failed(name, error)]; }
  }

  private findManifest(moduleFile: string): string {
    let directory = dirname(moduleFile);
    for (;;) {
      const candidate = join(directory, 'package.json');
      if (existsSync(candidate)) return candidate;
      const parent = dirname(directory);
      if (parent === directory) throw new Error('plugin package.json not found');
      directory = parent;
    }
  }
  private failed(name: string, error: unknown): string {
    const reason = (error instanceof Error ? error.message : String(error)).replace(/[\r\n\t]/g, ' ');
    return `error: plugin failed to activate: ${name.replace(/[\r\n\t]/g, ' ')} (${reason})`;
  }
  private record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object'; }
}
