// Mock GLib namespace

export function getenv(variable) {
  // Return mock environment variables
  const mockEnv = {
    'HOME': '/home/test',
    'USER': 'testuser',
    'SHELL': '/bin/bash',
  };
  return mockEnv[variable] || null;
}

export function get_home_dir() {
  return '/home/test';
}

export function get_user_data_dir() {
  return '/home/test/.local/share';
}

export function get_user_config_dir() {
  return '/home/test/.config';
}

export function build_filenamev(paths) {
  return paths.join('/');
}

export function file_test(file, test) {
  // Mock file test - always return true for simplicity
  return true;
}

export const FileTest = {
  EXISTS: 1 << 0,
  IS_REGULAR: 1 << 1,
  IS_SYMLINK: 1 << 2,
  IS_DIR: 1 << 3,
  IS_EXECUTABLE: 1 << 4
};

export const PRIORITY_DEFAULT = 0;
export const PRIORITY_HIGH = -100;
export const PRIORITY_LOW = 100;

export function timeout_add(priority, interval, callback) {
  // Mock timeout - return a fake ID
  return Math.random();
}

export function idle_add(priority, callback) {
  // Mock idle_add - execute callback immediately in tests
  if (typeof callback === 'function') {
    callback();
  }
  return Math.random();
}

export function source_remove(id) {
  // Mock source removal
  return true;
}

export function mkdir_with_parents(path, mode) {
  // Mock directory creation - return 0 for success
  return 0;
}

export default {
  getenv,
  get_home_dir,
  get_user_data_dir,
  get_user_config_dir,
  build_filenamev,
  file_test,
  FileTest,
  PRIORITY_DEFAULT,
  PRIORITY_HIGH,
  PRIORITY_LOW,
  timeout_add,
  idle_add,
  source_remove,
  mkdir_with_parents
};
