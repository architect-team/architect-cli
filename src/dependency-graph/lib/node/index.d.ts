export interface DependencyNodeOptions {
    name: string;
    image?: string;
    tag?: string;
    host?: string;
    ports: {
        target: string | number;
        expose: string | number;
    };
    parameters?: {
        [key: string]: string;
    };
}
export declare abstract class DependencyNode implements DependencyNodeOptions {
    name: string;
    tag: string;
    host: string;
    ports: {
        target: string | number;
        expose: string | number;
    };
    parameters: {
        [key: string]: string;
    };
    image?: string;
    protected constructor(options: DependencyNodeOptions);
    get normalized_ref(): string;
    get ref(): string;
    equals(node: DependencyNode): boolean;
}
