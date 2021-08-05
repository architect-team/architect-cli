
  // TODO:269:transform
  // getName(): string {
  //   const split = ServiceVersionSlugUtils.parse(this.name || '');
  //   return split.service_name;
  // }

  // getTag(): string {
  //   const split = ServiceVersionSlugUtils.parse(this.name || '');
  //   return split.tag;
  // }

  // getCommand() {
  //   if (!this.command) return [];
  //   if (this.command instanceof Array) {
  //     return this.command;
  //   }
  //   const env: Dictionary<string> = {};
  //   for (const key of Object.keys(this.getEnvironmentVariables())) {
  //     env[key] = `$${key}`;
  //   }
  //   return shell_parse(this.command, env).map(e => `${e}`);
  // }

  // getEntrypoint() {
  //   if (!this.entrypoint) return [];
  //   if (this.entrypoint instanceof Array) {
  //     return this.entrypoint;
  //   }
  //   const env: Dictionary<string> = {};
  //   for (const key of Object.keys(this.getEnvironmentVariables())) {
  //     env[key] = `$${key}`;
  //   }
  //   return shell_parse(this.entrypoint, env).map(e => `${e}`);
  // }

  // getEnvironmentVariables(): Dictionary<string> {
  //   const output: Dictionary<string> = {};
  //   for (const [k, v] of Object.entries(this.environment || {})) {
  //     if (v === null) { continue; }
  //     output[k] = `${v}`;
  //   }
  //   return output;
  // }

  // getVolumes(): Dictionary<VolumeSpec> {
  //   return transformVolumes(this.volumes) || {};
  // }

  // getBuild() {
  //   if (!this.build && !this.image) {
  //     this.build = new BuildSpec();
  //     this.build.context = '.';
  //   }
  //   return this.build || {};
  // }

  // /** @return New expanded copy of the current config */
  // expand() {
  //   const config = this.copy();

  //   const debug = config.getDebugOptions();
  //   if (debug) {
  //     config.setDebugOptions(debug.expand());
  //   }
  //   for (const [key, value] of Object.entries(this.getVolumes())) {
  //     config.setVolume(key, value);
  //   }
  //   return config;
  // }
}
