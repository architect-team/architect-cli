export type DockerComposeProject = {
  Name: string;
  Status: string;
  ConfigFiles: string | undefined;
};

export type DockerComposeProjectWithConfig = {
  Name: string;
  Status: string;
  ConfigFiles: string;
};
