// Mock Shell namespace

export class Global {
  constructor() {
    this.display = null;
    this.screen = null;
    this.workspace_manager = null;
    this.window_manager = null;
    this.stage = null;
  }

  get_display() {
    return this.display;
  }

  get_screen() {
    return this.screen;
  }

  get_workspace_manager() {
    return this.workspace_manager;
  }

  get_window_manager() {
    return this.window_manager;
  }

  get_stage() {
    return this.stage;
  }
}

export class App {
  constructor(params = {}) {
    this.id = params.id || 'mock.app';
    this.name = params.name || 'Mock App';
  }

  get_id() {
    return this.id;
  }

  get_name() {
    return this.name;
  }

  get_windows() {
    return [];
  }
}

export class AppSystem {
  static get_default() {
    return new AppSystem();
  }

  lookup_app(appId) {
    return new App({ id: appId });
  }

  get_running() {
    return [];
  }
}

export default {
  Global,
  App,
  AppSystem
};
