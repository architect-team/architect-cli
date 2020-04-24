export default class DockerNotInstalledError extends Error {
  constructor() {
    super();
    this.name = 'docker_not_installed';
    this.message = 'Architect requires Docker to be installed. Please install it and try again.';
  }
}
