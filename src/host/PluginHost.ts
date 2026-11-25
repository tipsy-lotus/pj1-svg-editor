import { CommandDispatcher } from '../cli/CommandDispatcher.js';
import { ShapeFactory } from '../model/ShapeFactory.js';
import { AttributeRegistry } from '../extensions/AttributeRegistry.js';
import { TreeDecoratorRegistry } from '../extensions/TreeDecoratorRegistry.js';
import type { EditorAccess } from '../extensions/EditorAccess.js';
import type { Plugin } from '../extensions/Plugin.js';
import type { PluginContext } from '../extensions/PluginContext.js';
import type { PluginManifest } from './PluginManifest.js';

/** 宿主负责暂存、清单核对与发布；不导入任何具体插件。 */
export class PluginHost {
  private queue: Promise<void> = Promise.resolve();
  readonly dispatcher: CommandDispatcher;
  constructor(
    private readonly session: EditorAccess,
    readonly shapes = new ShapeFactory(),
    readonly attributes = new AttributeRegistry(),
    readonly decorators = new TreeDecoratorRegistry(),
  ) { this.dispatcher = new CommandDispatcher(session, shapes, attributes, decorators); }

  activate(plugin: Plugin, manifest: PluginManifest, options?: unknown): Promise<readonly string[]> {
    const operation = this.queue.then(() => this.activateOne(plugin, manifest, options));
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }
  private async activateOne(plugin: Plugin, manifest: PluginManifest, options?: unknown): Promise<readonly string[]> {
    const shapes = new ShapeFactory(); this.shapes.entries.forEach(item => shapes.register(item));
    const attributes = new AttributeRegistry(); this.attributes.entries.forEach(item => attributes.register(item));
    const decorators = new TreeDecoratorRegistry(); this.decorators.entries.forEach(item => decorators.register(item));
    const commands = new CommandDispatcher(this.session, shapes, attributes, decorators);
    this.dispatcher.context.commands().forEach(item => commands.register(item));
    const sizes = { shapes: shapes.entries.length, attributes: attributes.entries.length,
      decorators: decorators.entries.length, commands: commands.context.commands().length };
    let closed = false;
    let registrationFailure: unknown;
    const register = (operation: () => void): void => {
      if (closed) throw new Error('plugin registration is closed');
      try { operation(); } catch (error) { registrationFailure = error; throw error; }
    };
    const liveShapes = this.shapes;
    const context: PluginContext = {
      ...this.dispatcher.context,
      shapes: Object.freeze({
        create: this.shapes.create.bind(this.shapes), fromAttributes: this.shapes.fromAttributes.bind(this.shapes),
        fromSvg: this.shapes.fromSvg.bind(this.shapes), get help() { return liveShapes.help; },
      }),
      attributes: Object.freeze({ apply: this.attributes.apply.bind(this.attributes) }),
      registerShape: item => register(() => shapes.register(item)),
      registerCommand: item => register(() => commands.register(item)),
      registerAttribute: item => register(() => attributes.register(item)),
      registerDecorator: item => register(() => decorators.register(item)),
    };
    try {
      await plugin.activate(context, options);
      closed = true;
      if (registrationFailure) throw registrationFailure;
      const pending = {
        shapes: shapes.entries.slice(sizes.shapes), commands: commands.context.commands().slice(sizes.commands),
        attributes: attributes.entries.slice(sizes.attributes), decorators: decorators.entries.slice(sizes.decorators),
      };
      const registered = Object.fromEntries(Object.entries(pending).map(([category, items]) => [category, items.map(item => item.name).sort()]));
      const declared: Record<string, string[]> = {};
      let valid = typeof manifest.name === 'string' && manifest.name.length > 0;
      const contributes = manifest.contributes ?? {};
      valid = valid && typeof contributes === 'object' && !Array.isArray(contributes)
        && Object.keys(contributes).every(category => Object.hasOwn(registered, category));
      for (const category of ['shapes', 'commands', 'attributes', 'decorators'] as const) {
        const names = contributes[category] ?? [];
        if (!Array.isArray(names) || !names.every(name => typeof name === 'string') || new Set(names).size !== names.length) valid = false;
        declared[category] = Array.isArray(names) ? [...names].sort() : [];
        if (JSON.stringify(declared[category]) !== JSON.stringify(registered[category])) valid = false;
      }
      if (!valid) return [`error: plugin manifest mismatch: ${manifest.name} (declared: ${JSON.stringify(declared)}, registered: ${JSON.stringify(registered)})`];
      const rollback = [this.shapes.checkpoint(), this.dispatcher.checkpoint(), this.attributes.checkpoint(), this.decorators.checkpoint()];
      try {
        pending.shapes.forEach(item => this.shapes.register(item));
        pending.commands.forEach(item => this.dispatcher.register(item));
        pending.attributes.forEach(item => this.attributes.register(item));
        pending.decorators.forEach(item => this.decorators.register(item));
      } catch (error) { rollback.forEach(restore => restore()); throw error; }
      return [];
    } catch (error) {
      const reason = (error instanceof Error ? error.message : String(error)).replace(/[\r\n\t]/g, ' ');
      return [reason.startsWith('duplicate registration: ') ? `error: ${reason}`
        : `error: plugin failed to activate: ${manifest.name} (${reason})`];
    } finally { closed = true; }
  }
}
