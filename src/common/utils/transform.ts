import { plainToClass, Transform } from 'class-transformer'

/**
 * Used in conjunction with the @Transform annotation from the 'class-transformer'
 * library to create class structures for nested dictionaries.
 */
export const Dict = (typeFunction: any, options?: { key?: string }) =>
  (dict: any) => {
    const classType = typeFunction();
    for (let [key, value] of Object.entries(dict)) {
      if (options && options.key && typeof value === 'string') {
        const new_value: any = {};
        new_value[options.key] = value;
        value = new_value;
      }
      dict[key] = plainToClass(classType, value);
    }
    return dict;
  };

/**
 * Decorator used alongside class transformation to assign default values to fields
 */
export const Default = (defaultValue: any) =>
  Transform((target: any) => target || defaultValue);
