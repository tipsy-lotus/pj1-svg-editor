import { DefaultDispatcher as CommandDispatcher } from '../../src/host/DefaultDispatcher.js';
import type { EditorSession } from '../../src/application/EditorSession.js';
import { DefaultShapes } from '../../src/host/DefaultShapes.js';

export class DefaultDispatcher extends CommandDispatcher {
  constructor(session: EditorSession) { super(session, new DefaultShapes()); }
}
