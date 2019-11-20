import { DependencyNodeOptions, DependencyNode } from '.';
export interface ServiceNodeOptions {
    subscriptions?: {
        [service_name: string]: {
            [event_name: string]: {
                uri: string;
                headers?: {
                    [key: string]: string;
                };
            };
        };
    };
    api: {
        type: string;
        definitions?: string[];
    };
}
export declare class ServiceNode extends DependencyNode implements ServiceNodeOptions {
    subscriptions: {
        [service_name: string]: {
            [event_name: string]: {
                uri: string;
                headers?: {
                    [key: string]: string;
                } | undefined;
            };
        };
    };
    api: {
        type: string;
        definitions?: string[] | undefined;
    };
    constructor(options: ServiceNodeOptions & DependencyNodeOptions);
}
