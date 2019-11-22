export interface DependencyNodeOptions {
  name: string;
  image?: string;
  tag?: string;
  host?: string;
  ports: {
    target: string | number;
    expose: string | number;
  };
  parameters?: { [key: string]: string | number };
}

export abstract class DependencyNode implements DependencyNodeOptions {
  name: string;
  tag: string;
  host: string;
  ports: { target: string | number; expose: string | number };
  parameters: { [key: string]: string | number };
  image?: string;

  protected constructor(options: DependencyNodeOptions) {
    this.name = options.name;
    this.ports = options.ports;
    this.image = options.image;
    this.host = options.host || '0.0.0.0';
    this.tag = options.tag || 'latest';
    this.parameters = options.parameters || {};
  }

  get normalized_ref() {
    return this.ref
      .replace(/:/g, '.')
      .replace(/\//g, '.');
  }

  get ref() {
    return `${this.name}:${this.tag}`;
  }

  equals(node: DependencyNode) {
    return this.ref === node.ref;
  }
}
