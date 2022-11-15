import {AsyncLocalStorage} from "async_hooks";

type AsyncFun<T> = (...args: any[]) => PromiseLike<T>;
type AsyncMethods<Class> = {
	[Property in keyof Class as Class[Property] extends AsyncFun<infer T> ? Property : never]: Class[Property]
};
type AsyncMethodName<T> = keyof AsyncMethods<T>;

const globalScope = {};
const localStorage = new AsyncLocalStorage();

const scoped = <Class>(target: Class, propertyKey: AsyncMethodName<Class>, descriptor: PropertyDescriptor) => {
	const originalMethod = target[propertyKey] as AsyncFun<any>;
	descriptor.value = async function (this, ...args) {
		return declareScope(() => originalMethod.bind(this)(...args));
	};
	return descriptor;
};

const declareScope = <T>(callback: () => Promise<T>): Promise<T> =>
	localStorage.run({...getScope()}, callback);

const getScope = () => (localStorage.getStore() ?? globalScope) as Record<string, unknown>;

const get = <T>(key: string): T => getScope()[key] as T;
const set = <T>(key: string, value: T): T => getScope()[key] = value;

export {scoped, declareScope};
export default {get, set};
