import {AsyncLocalStorage} from "async_hooks";

type AsyncFun<T> = (...args: any[]) => PromiseLike<T>;
type AsyncMethods<Class> = {
	[Property in keyof Class as Class[Property] extends AsyncFun<infer T> ? Property : never]: Class[Property]
};
type AsyncMethodName<T> = keyof AsyncMethods<T>;

type Scope = {parentScope?: Scope, bindings: Record<string, unknown>};

const globalScope: Scope = {bindings: {}};
const localStorage = new AsyncLocalStorage();

const scopedMethod = <Class>(target: Class, propertyKey: AsyncMethodName<Class>, descriptor: PropertyDescriptor) => {
	const originalMethod = target[propertyKey] as AsyncFun<any>;
	descriptor.value = async function (this, ...args) {
		return scopedFunction(originalMethod).bind(this)(...args);
	};
	return descriptor;
};

const scopedFunction = <T extends AsyncFun<any>>(callback: T): T => {
	return function (this, ...args: Parameters<T>): ReturnType<T> {
		return declareScope((): ReturnType<T> => callback.bind(this)(...args) as ReturnType<T>);
	} as unknown as T;
};

const declareScope = <T extends PromiseLike<any>>(callback: () => T): T => {
	const scope: Scope = {parentScope: localScope(), bindings: {}};
	return localStorage.run(scope, callback);
}

const localScope = (): Scope => localStorage.getStore() as Scope ?? globalScope;

const boundScope = (identifier: string): Scope | undefined => {
	const findScope = (scope: Scope): Scope | undefined => {
		if (scope === undefined || (identifier in scope.bindings)) {
			return scope;
		} else {
			return findScope(scope.parentScope);
		}
	};
	return findScope(localScope());
};

const setInScope = <T>(identifier: string, value: T) => (scope: Scope): T => scope.bindings[identifier] = value;
const getFromScope = <T>(identifier: string) => (scope: Scope): T => scope.bindings[identifier] as T;

const inBoundScope = <T>(identifier: string, callback: (scope: Scope) => T) => {
	const scope = boundScope(identifier);
	if (scope === undefined) {
		throw new Error(`Identifier "${identifier}" is not bound`);
	} else {
		return callback(scope);
	}
};

const bind = <T>(identifier: string, value: T): T => {
	const scope = localScope();
	if (identifier in scope.bindings) {
		throw new Error(`Identifier "${identifier}" already bound in the local scope`);
	} else {
		return setInScope(identifier, value)(scope);
	}
};

const access = <T>(identifier: string): T => inBoundScope(identifier, getFromScope(identifier));

const mutate = <T>(identifier: string, value: T): T => inBoundScope(identifier, setInScope(identifier, value));

export {scopedMethod, scopedFunction, declareScope};
export default {bind, access, mutate};
