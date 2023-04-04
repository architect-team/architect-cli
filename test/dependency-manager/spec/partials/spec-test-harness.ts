import deepmerge from 'deepmerge';
import fs from 'fs-extra';
import path from 'path';
import { parseSourceYml } from '../../../../src';

const xor_spec_properties: string[][] = [ // can't let conflicting properties be joined in one spec
  ['build', 'image'],
];

const lsDirectories = (dir: string) => {
  return fs.readdirSync(path.resolve(dir), { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
}

export interface RecursivePartialsTree {
  children: { [key: string]: RecursivePartialsTree };
  partials: Record<string, any>[];
}

const recursiveBuildTree = (dir: string): RecursivePartialsTree => {
  const files = readFiles(dir);
  const parsed_source_ymls = files.map(s => parseSourceYml(s) as object);
  const directories = lsDirectories(dir);
  const children = directories.reduce((obj: { [key: string]: RecursivePartialsTree }, dir_name: string) => {
    obj[dir_name] = recursiveBuildTree(`${dir}/${dir_name}`);
    return obj;
  }, {});
  return {
    children,
    partials: parsed_source_ymls
  };
}

const recursiveMergeTree = (tree: RecursivePartialsTree): object[] => {
  if (!Object.keys(tree.children).length) {
    return tree.partials;
  }

  return Object.entries(tree.children)
    .map(([child_key, child_tree]) => {
      const child_partials = recursiveMergeTree(child_tree);

      const merged_partials = tree.partials.map(current_partial => {
        let accums: object[] = [];
        for (const child_partial of child_partials) {
          if (child_key.startsWith('_')) {
            let accum = current_partial;
            const resource_name = Object.keys(accum)[0];

            const spec_child_key = child_key.replace('_', '');
            let xor_mapping_values;
            for (const xor_array of xor_spec_properties) {
              if (xor_array.includes(spec_child_key)) {
                xor_mapping_values = xor_array.filter(v => v !== spec_child_key);
                break;
              }
            }
            let alt_accums: object[] = [];
            for (const xor_mapping_value of (xor_mapping_values || [])) {
              if (Object.keys(accum[resource_name]).includes(xor_mapping_value)) {
                const alt_accum = JSON.parse(JSON.stringify(accum)); // deep copy
                delete alt_accum[resource_name][xor_mapping_value];
                for (const current_key of Object.keys(alt_accum)) {
                  alt_accum[current_key] = deepmerge(alt_accum[current_key], { [spec_child_key]: child_partial });
                }
                alt_accums.push(alt_accum);
              }
            }

            if (!alt_accums.length) { // if not alternative, current partial should be added to the spec
              for (const current_key of Object.keys(accum)) {
                accum[current_key] = deepmerge(accum[current_key], { [spec_child_key]: child_partial });
              }
            }

            accums = accums.concat([accum, ...alt_accums]);
          } else {
            accums.push(deepmerge(current_partial, { [child_key]: child_partial }) as object);
          }
        }
        return accums;
      }).reduce((accumulator, value) => accumulator.concat(value), []);

      return merged_partials;
    }).reduce((accumulator, value) => accumulator.concat(value), []);
}

const readFiles = (directory: string): string[] => {
  return fs.readdirSync(directory)
    .filter(f => fs.lstatSync(path.resolve(directory, f)).isFile())
    .map(f => {
      return fs.readFileSync(path.resolve(directory, f), 'utf-8');
    });
};

export const loadAllTestSpecCombinations = (): object[] => {
  const root_partials_dir = `test/dependency-manager/spec/partials/root`;
  const tree = recursiveBuildTree(root_partials_dir);
  return recursiveMergeTree(tree);
}
