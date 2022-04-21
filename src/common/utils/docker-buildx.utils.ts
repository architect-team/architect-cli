import execa, { Options } from "execa";
import fs from "fs-extra";

export default class DockerBuildXUtils {

  public static isMacM1Machine() {
    return require("os").cpus()[0].model.includes("Apple M1");
  }

  public static getPlatforms(): string[] {
    let platforms: string[] = ["linux/amd64"];
    return this.isMacM1Machine() ? [...platforms, "linux/arm64"] : platforms;
  }

  public static async writeBuildkitdConfigFile(file_name: string, file_content: string): Promise<void> {
    await fs.writeFile(file_name, file_content, (err) => {
      if (err) {
        throw new Error("Failed to create Buildkit configuration file!");
      }
    });
  }

  public static async dockerBuildX(args: string[], execa_opts?: Options, use_console = false): Promise<execa.ExecaChildProcess<string>> {
    if (use_console) {
      process.stdin.setRawMode(true);
    }
    const cmd = execa("docker", ["buildx", ...args], execa_opts);
    if (use_console) {
      cmd.on("exit", () => {
        process.exit();
      });
    }
    return cmd;
  }

}
