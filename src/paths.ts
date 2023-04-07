export default class LocalPaths {
  static CLI_CONFIG_FILENAME = 'config.json';
  static LINKED_COMPONENT_MAP_FILENAME = 'linked-components.json';
  static LOCAL_DEPLOY_PATH = 'docker-compose';
  static SENTRY_FILENAME = 'sentry-history.json';
  static POSTHOG_PROPERTIES = 'posthog.json';
  static GITHUB_TEMPLATE_CONFIG_URL = 'https://raw.githubusercontent.com/architect-team/template-configs/main/config.json';
  // eslint-disable-next-line unicorn/prefer-module
  static SENTRY_ROOT_PATH = process.cwd(); // TODO:TJ
}
