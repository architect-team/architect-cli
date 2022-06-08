
type SentryContextHandler = (error: Error, ctx: any) => any;

function _handleError(ctx: any, error_type: any, error: Error, handler?: SentryContextHandler) {
  if (handler && typeof handler === 'function' && error instanceof error_type) {
    const err: any = handler.call(null, error, ctx);
    throw err;
  } else {
    throw error;
  }
}

function _generateDescriptor(descriptor: PropertyDescriptor, error_type: any, handler?: SentryContextHandler): PropertyDescriptor {
  const original_method = descriptor.value;
  descriptor.value = function (...args: any[]) {
    try {
      const result = original_method.apply(this, args);
      if (result && result instanceof Promise) {
        return result.catch((error: any) => {
          _handleError(this, error_type, error, handler);
        });
      }
      return result;
    } catch (error: any) {
      _handleError(this, error_type, error, handler);
    }
  };
  return descriptor;
}

// class/method decorator
export const ToSentry = (error_type: any, handler?: SentryContextHandler): any => {
  return (target: any, property_key: string, descriptor: PropertyDescriptor) => {
    if (descriptor) {
      return _generateDescriptor(descriptor, error_type, handler);
    } else {
      const property_names = Reflect.ownKeys(target.prototype).filter(prop => prop !== 'constructor');
      for (const property_name of property_names) {
        const descriptor = Object.getOwnPropertyDescriptor(target.prototype, property_name);
        const is_method = descriptor?.value instanceof Function;
        if (!is_method) {
          continue;
        }
        Object.defineProperty(target.prototype, property_name, _generateDescriptor(descriptor, error_type, handler));
      }
    }
  };
};
