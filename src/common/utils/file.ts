import fs from 'fs-extra';
import path from 'path';
import untildify from 'untildify';

export const readIfFile = async (string_or_path: string): Promise<string> => {
  if (string_or_path && string_or_path.startsWith('file:')) {
    const res = await fs.readFile(path.resolve(untildify(string_or_path.slice('file:'.length))), 'utf-8');
    return res.trim();
  } else {
    return string_or_path;
  }
};
