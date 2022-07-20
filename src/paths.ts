export default class LocalPaths {
  static CLI_CONFIG_FILENAME = 'config.json';
  static LINKED_COMPONENT_MAP_FILENAME = 'linked-components.json';
  static LOCAL_DEPLOY_PATH = 'docker-compose';
  static SENTRY_FILENAME = 'sentry-history.json';
  static SENTRY_ROOT_PATH = __dirname || process.cwd();
}
