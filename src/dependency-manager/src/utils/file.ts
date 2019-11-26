import fs from 'fs-extra';
import path from 'path';
import untildify from 'untildify';

export const readIfFile = (string_or_path: string): string => {
  if (string_or_path && string_or_path.startsWith('file:')) {
    const res = fs.readFileSync(path.resolve(untildify(string_or_path.slice('file:'.length))), 'utf-8');
    return res.trim();
  } else {
    return string_or_path;
  }
};
