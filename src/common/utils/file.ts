import fs from 'fs-extra';
import path from 'path';
import untildify from 'untildify';

export const readIfFile = (any_or_path: any): any => {
  if (any_or_path && any_or_path.startsWith && any_or_path.startsWith('file:')) {
    const res = fs.readFileSync(path.resolve(untildify(any_or_path.slice('file:'.length))), 'utf-8');
    return res.trim();
  } else {
    return any_or_path;
  }
};
