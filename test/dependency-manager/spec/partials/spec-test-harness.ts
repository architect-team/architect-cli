import deepmerge from 'deepmerge';
import fs from 'fs-extra';
import path from 'path';
import { parseSourceYml } from '../../../../src';

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
        return child_partials.map(child_partial => {
          if (child_key.startsWith('_')) {
            let accum = current_partial;
            for (const current_key of Object.keys(accum)) {
              accum[current_key] = deepmerge(accum[current_key], { [child_key.replace('_', '')]: child_partial });
            }
            return accum;
          } else {
            return deepmerge(current_partial, { [child_key]: child_partial }) as object
          }
        });
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
