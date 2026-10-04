// SANDBOX ONLY: lets the test harness use org.gnome.Shell.Eval inside the nested shell.
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

export default class SandboxUnsafe extends Extension {
  enable() {
    global.context.unsafe_mode = true;
  }

  disable() {
    global.context.unsafe_mode = false;
  }
}
