import { plainToClass, Transform } from 'class-transformer';
import { ClassType } from 'class-transformer/ClassTransformer';
import { Dictionary } from './dictionary';

/**
 * Used in conjunction with the @Transform annotation from the 'class-transformer'
 * library to create class structures for nested dictionaries.
 */
export const Dict = <T>(typeFunction: () => ClassType<T>, options?: { key?: string }) =>
  (dict?: Dictionary<any>): Dictionary<T> | undefined => {
    if (!dict) {
      return undefined;
    }

    const res = {} as Dictionary<T>;
    const classType = typeFunction();
    for (const key of Object.keys(dict)) {
      let value = dict[key];
      if (options && options.key && typeof value === 'string') {
        const new_value: any = {};
        new_value[options.key] = value;
        value = new_value;
      }
      res[key] = plainToClass(classType, value);
    }
    return res;
  };

/**
 * Decorator used alongside class transformation to assign default values to fields
 */
export const Default = (defaultValue: any) =>
  Transform((target: any) => target || defaultValue);
