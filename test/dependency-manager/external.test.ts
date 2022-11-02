import { expect } from '@oclif/test';
import axios from 'axios';
import yaml from 'js-yaml';
import mock_fs from 'mock-fs';
import path from 'path';
import { resourceRefToNodeRef, ServiceNode } from '../../src';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../../src/common/docker-compose';
import DockerComposeTemplate from '../../src/common/docker-compose/template';

describe('external spec v1', () => {

  it('simple external', async () => {
    const component_config = {
      name: 'cloud',
      services: {
        app: {
          interfaces: {
            main: {
              host: 'cloud.architect.io',
              port: 8080
            }
          },
          environment: {
            HOST: '${{ services.app.interfaces.main.host }}',
            ADDR: '${{ services.app.interfaces.main.url }}'
          }
        }
      },
      interfaces: {}
    };

    mock_fs({
      '/stack/architect.yml': yaml.dump(component_config),
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'cloud': '/stack/architect.yml'
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('cloud:latest')
    ]);

    const app_ref = resourceRefToNodeRef('cloud.services.app')
    expect(graph.nodes.map((n) => n.ref)).has.members([
      app_ref,
    ])
    expect(graph.edges.map((e) => e.toString())).has.members([])
    const app_node = graph.getNodeByRef(app_ref) as ServiceNode;
    expect(app_node.is_external).to.be.true;
    expect(app_node.config.environment).to.deep.equal({
      HOST: 'cloud.architect.io',
      ADDR: 'http://cloud.architect.io:8080'
    })

    const template = await DockerComposeUtils.generate(graph);
    expect(template).to.be.deep.equal({
      'services': {},
      'version': '3',
      'volumes': {},
    })
  });

  it('simple no override', async () => {
    const component_config = {
      name: 'cloud',
      secrets: {
        optional_host: { required: false },
        optional_port: { default: 8080 }
      },
      services: {
        app: {
          interfaces: {
            main: {
              host: '${{ secrets.optional_host }}',
              port: '${{ secrets.optional_port }}'
            }
          },
          environment: {
            HOST: '${{ services.app.interfaces.main.host }}',
            ADDR: '${{ services.app.interfaces.main.url }}'
          }
        }
      },
      interfaces: {}
    };

    mock_fs({
      '/stack/architect.yml': yaml.dump(component_config),
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'cloud': '/stack/architect.yml'
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('cloud:latest')
    ]);

    const app_ref = resourceRefToNodeRef('cloud.services.app')
    expect(graph.nodes.map((n) => n.ref)).has.members([
      app_ref,
    ])
    expect(graph.edges.map((e) => e.toString())).has.members([])
    const app_node = graph.getNodeByRef(app_ref) as ServiceNode;
    expect(app_node.is_external).to.be.false;
    expect(app_node.config.environment).to.deep.equal({
      HOST: app_ref,
      ADDR: `http://${app_ref}:8080`
    })
  });

  it('simple external override', async () => {
    const component_config = {
      name: 'cloud',
      secrets: {
        optional_host: {},
        optional_port: { default: 8080 }
      },
      services: {
        app: {
          interfaces: {
            main: {
              host: '${{ secrets.optional_host }}',
              port: '${{ secrets.optional_port }}'
            }
          },
          environment: {
            HOST: '${{ services.app.interfaces.main.host }}',
            ADDR: '${{ services.app.interfaces.main.url }}'
          }
        }
      },
      interfaces: {}
    };

    mock_fs({
      '/stack/architect.yml': yaml.dump(component_config),
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'cloud': '/stack/architect.yml'
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('cloud:latest')
      // @ts-ignore
    ], { '*': { optional_host: 'cloud.architect.io', optional_port: 8081 } });

    const app_ref = resourceRefToNodeRef('cloud.services.app')
    expect(graph.nodes.map((n) => n.ref)).has.members([
      app_ref,
    ])
    expect(graph.edges.map((e) => e.toString())).has.members([])
    const app_node = graph.getNodeByRef(app_ref) as ServiceNode;
    expect(app_node.is_external).to.be.true;
    expect(app_node.config.environment).to.deep.equal({
      HOST: 'cloud.architect.io',
      ADDR: 'http://cloud.architect.io:8081'
    })

    const template = await DockerComposeUtils.generate(graph);
    expect(template).to.be.deep.equal({
      'services': {},
      'version': '3',
      'volumes': {},
    })
  });

  it('service connecting to external', async () => {
    const component_config = {
      name: 'cloud',
      services: {
        app: {
          interfaces: {
            main: 8080
          },
          environment: {
            API_ADDR: '${{ services.api.interfaces.main.url }}',
            EXTERNAL_API_ADDR: '${{ services.api.interfaces.main.url }}'
          }
        },
        api: {
          interfaces: {
            main: {
              protocol: 'https',
              host: 'external.locahost',
              port: 443,
            }
          }
        }
      },
      interfaces: {}
    };

    mock_fs({
      '/stack/architect.yml': yaml.dump(component_config),
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'cloud': '/stack/architect.yml'
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('cloud:latest')
    ]);
    const app_ref = resourceRefToNodeRef('cloud.services.app')
    const api_ref = resourceRefToNodeRef('cloud.services.api')

    expect(graph.nodes.map((n) => n.ref)).has.members([
      app_ref,
      api_ref
    ])
    expect(graph.edges.map((e) => e.toString())).has.members([
      `${app_ref} [service->main] -> ${api_ref} [main]`
    ])
    const app_node = graph.getNodeByRef(app_ref) as ServiceNode;
    expect(app_node.is_external).to.be.false;
    const api_node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(api_node.is_external).to.be.true;

    const template = await DockerComposeUtils.generate(graph);
    const expected_compose: DockerComposeTemplate = {
      services: {
        [app_ref]: {
          environment: {
            API_ADDR: 'https://external.locahost',
            EXTERNAL_API_ADDR: 'https://external.locahost'
          },
          ports: [
            '50000:8080'
          ],
          build: {
            context: path.resolve('/stack')
          },
          image: app_ref,
          labels: ['architect.ref=cloud.services.app']
        }
      },
      'version': '3',
      'volumes': {},
    };
    expect(template).to.be.deep.equal(expected_compose);
  });

  it('dependency refs external host', async () => {
    const component_config = `
      name: component
      dependencies:
        dependency: latest
      services:
        app:
          image: hashicorp/http-echo
          environment:
            DEP_ADDR: \${{ dependencies.dependency.interfaces.api.url }}
            CI_ADDR: \${{ dependencies.dependency.interfaces.ci.url }}
            DEP_EXTERNAL_ADDR: \${{ dependencies.dependency.ingresses.api.url }}
            CI_EXTERNAL_ADDR: \${{ dependencies.dependency.ingresses.ci.url }}
    `;

    const dependency_config = `
      name: dependency
      secrets:
        optional_host: ci.architect.io
      services:
        app:
          image: hashicorp/http-echo
          interfaces:
            api:
              port: 443
              protocol: https
              host: external.localhost
            ci:
              port: 8501
              protocol: https
              host: \${{ secrets.optional_host }}
          environment:
            DEP_EXTERNAL_ADDR: \${{ ingresses.api.url }}
            CI_EXTERNAL_ADDR: \${{ ingresses.ci.url }}
            CI_SUBDOMAIN: \${{ ingresses.ci.subdomain }}
            # CI_DNS_ZONE: \${{ ingresses.ci.dns_zone }}
      interfaces:
        api: \${{ services.app.interfaces.api.url }}
        ci: \${{ services.app.interfaces.ci.url }}
    `;

    mock_fs({
      '/stack/component/architect.yml': component_config,
      '/stack/dependency/architect.yml': dependency_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'component': '/stack/component/architect.yml',
      'dependency': '/stack/dependency/architect.yml'
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('component:latest'),
      await manager.loadComponentSpec('dependency:latest')
    ]);

    const app_ref = resourceRefToNodeRef('component.services.app')
    const test_node = graph.getNodeByRef(app_ref) as ServiceNode;
    expect(test_node.config.environment).to.deep.eq({
      DEP_ADDR: `https://external.localhost`,
      CI_ADDR: `https://ci.architect.io:8501`,
      DEP_EXTERNAL_ADDR: `https://external.localhost`,
      CI_EXTERNAL_ADDR: `https://ci.architect.io:8501`
    });

    const dep_ref = resourceRefToNodeRef('dependency.services.app')
    const dep_node = graph.getNodeByRef(dep_ref) as ServiceNode;
    expect(dep_node.config.environment).to.deep.eq({
      DEP_EXTERNAL_ADDR: `https://external.localhost`,
      CI_EXTERNAL_ADDR: `https://ci.architect.io:8501`,
      CI_SUBDOMAIN: 'ci',
      // CI_DNS_ZONE: 'architect.io'
    });
  });

  it('should strip default ports from environment ingress references', async () => {
    const component_config = `
      name: component
      services:
        app:
          image: hashicorp/http-echo
          interfaces:
            api: 8080
          environment:
            SELF_ADDR: \${{ ingresses.app.url }}
            SELF_ADDR2: \${{ environment.ingresses['component'].app.url }}
      interfaces:
        app: \${{ services.app.interfaces.api.url }}
    `;

    mock_fs({
      '/stack/component/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'component': '/stack/component/architect.yml'
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('component:latest')
    ]);

    const app_ref = resourceRefToNodeRef('component.services.app')
    const test_node = graph.getNodeByRef(app_ref) as ServiceNode;
    expect(test_node.config.environment).to.deep.eq({
      SELF_ADDR: `http://app.arc.localhost`,
      SELF_ADDR2: `http://app.arc.localhost`,
    });
  });

  it('host override db via secret', async () => {
    const component_config = `
      name: component

      secrets:
        MYSQL_HOST:
          required: false
        MYSQL_DATABASE:
          required: true

      services:
        db:
          image: mysql:5.6.35
          command: mysqld
          interfaces:
            mysql:
              host: \${{ secrets.MYSQL_HOST }}
              port: 3306
              protocol: mysql

        core:
          environment:
            MYSQL_DB_URL: jdbc:mysql://\${{ services.db.interfaces.mysql.host }}:\${{ services.db.interfaces.mysql.port }}/\${{ secrets.MYSQL_DATABASE }}?serverTimezone=UTC
            MYSQL_DB_URL2: jdbc:\${{ services.db.interfaces.mysql.url }}/\${{ secrets.MYSQL_DATABASE }}?serverTimezone=UTC
    `;

    mock_fs({
      '/stack/component/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'component': '/stack/component/architect.yml'
    });

    const core_ref = resourceRefToNodeRef('component.services.core')
    const db_ref = resourceRefToNodeRef('component.services.db')

    // No host override
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('component:latest')
    ], { '*': { MYSQL_DATABASE: 'test' } });
    const test_node = graph.getNodeByRef(core_ref) as ServiceNode;
    expect(test_node.config.environment).to.deep.eq({
      MYSQL_DB_URL: `jdbc:mysql://${db_ref}:3306/test?serverTimezone=UTC`,
      MYSQL_DB_URL2: `jdbc:mysql://${db_ref}:3306/test?serverTimezone=UTC`,
    });

    // Host override
    const graph2 = await manager.getGraph([
      await manager.loadComponentSpec('component:latest')
    ], { '*': { MYSQL_HOST: 'external', MYSQL_DATABASE: 'test' } });
    const test_node2 = graph2.getNodeByRef(core_ref) as ServiceNode;
    expect(test_node2.config.environment).to.deep.eq({
      MYSQL_DB_URL: `jdbc:mysql://external:3306/test?serverTimezone=UTC`,
      MYSQL_DB_URL2: `jdbc:mysql://external:3306/test?serverTimezone=UTC`,
    });
  });

  it('host override via templating', async () => {
    const component_config = `
      name: component

      services:
        db:
          image: mysql:5.6.35
          command: mysqld
          interfaces:
            mysql:
              \${{ if architect.environment == 'local' }}:
                port: 3306
                host: external-db.localhost
              port: 3306
              protocol: mysql

        core:
          environment:
            MYSQL_DB_URL: \${{ services.db.interfaces.mysql.url }}
    `;

    mock_fs({
      '/stack/component/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'component': '/stack/component/architect.yml'
    });

    const core_ref = resourceRefToNodeRef('component.services.core')

    const graph = await manager.getGraph([
      await manager.loadComponentSpec('component:latest')
    ]);

    const test_node = graph.getNodeByRef(core_ref) as ServiceNode;
    expect(test_node.config.environment).to.deep.eq({
      MYSQL_DB_URL: `mysql://external-db.localhost:3306`,
    });
  });
});
