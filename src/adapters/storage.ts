import {createHook, executionAsyncId} from "async_hooks";

const scopes = new Map<number, Record<string, unknown>>();

createHook({
	init: (asyncId: number, _type: string, triggerAsyncId: number) => {
		if (scopes.has(triggerAsyncId)) {
			const outerScope = scopes.get(triggerAsyncId);
			scopes.set(asyncId, {...outerScope});
		}
	},
	destroy: (asyncId: number) => scopes.delete(asyncId),
});

const localScope = () => {
	const asyncId = executionAsyncId();
	if (!scopes.has(asyncId)) {
		scopes.set(asyncId, {});
	}
	return scopes.get(asyncId);
};

const get = <T>(key: string): T => localScope()[key] as T; // aka trust me

const set = <T>(key: string, value: T): T => localScope()[key] = value;

export default {get, set};
