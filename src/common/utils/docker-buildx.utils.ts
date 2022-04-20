import execa, { Options } from "execa";

export default class DockerBuildXUtils {

    public static isMacM1Machine() {
        return require("os").cpus()[0].model.includes("Apple M1");
    }

    /**
     * Detects platforms
     * @returns a list of platform
     */
    public static getPlatforms(): string[] {
        return [];
    }

    public static async dockerBuildX(args: string[], execa_opts?: Options, use_console = false): Promise<execa.ExecaChildProcess<string>> {
        // await this.dockerBuildXCommandCheck();
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
