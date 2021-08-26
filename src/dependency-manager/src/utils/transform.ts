import { ClassConstructor, plainToClass } from 'class-transformer';
import { Dictionary } from './dictionary';

/**
 * Used in conjunction with the @Transform annotation from the 'class-transformer'
 * library to create class structures for nested dictionaries.
 */
export const Dict = <T>(typeFunction: () => ClassConstructor<T>, options?: { key?: string }) =>
  (dict?: Dictionary<any>): Dictionary<T> | undefined => {
    if (!dict) {
      return undefined;
    }

    const res = {} as Dictionary<T>;
    const classConstructor = typeFunction();
    for (const key of Object.keys(dict)) {
      let value = dict[key];
      if (options && options.key && typeof value === 'string') {
        const new_value: any = {};
        new_value[options.key] = value;
        value = new_value;
      }
      res[key] = plainToClass(classConstructor, value);
    }
    return res;
  };
