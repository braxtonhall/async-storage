import {expect} from "chai";
import scopes, {declareScope, scopedFunction, scopedMethod} from "../../src/decorators/proper-scopes";
import {sleep} from "../../src/util/sleep";
import {randomUUID} from "crypto";

const access = async (key: string): Promise<string> => scopes.access(key);
const bind = async (key: string, value: string): Promise<string> => scopes.bind(key, value);
const mutate = async (key: string, value: string): Promise<string> => scopes.mutate(key, value);

describe("scopes", () => {

	it("should not have anything in global scope from the beginning", async () => {
		const key = randomUUID();
		try {
			await access(key);
		} catch (error) {
			expect(error).to.be.instanceOf(Error);
			return;
		}
		expect.fail("Access should have caused an unbound identifier error");
	});

	it("should not have anything in a nested scope from the beginning", async () => {
		const key = randomUUID();
		try {
			await declareScope(() => Promise.resolve().then(() => access(key)));
		} catch (error) {
			expect(error).to.be.instanceOf(Error);
			return;
		}
		expect.fail("Access should have caused an unbound identifier error");
	});

	it("should not be able to mutate unbound identifiers in the global scope", async () => {
		const key = randomUUID();
		const value = randomUUID();
		try {
			await mutate(key, value);
		} catch (error) {
			expect(error).to.be.instanceOf(Error);
			return;
		}
		expect.fail("Access should have caused an unbound identifier error");
	});

	it("should not be able to mutate unbound identifiers in a nested scope", async () => {
		const key = randomUUID();
		const value = randomUUID();
		try {
			await declareScope(() => Promise.resolve().then(() => mutate(key, value)));
		} catch (error) {
			expect(error).to.be.instanceOf(Error);
			return;
		}
		expect.fail("Access should have caused an unbound identifier error");
	});

	it("should be able to bind values in scope", async () => {
		const key = randomUUID();
		const value = randomUUID();
		const futureResult = declareScope(() => Promise.resolve()
			.then(() => bind(key, value))
			.then(() => access(key)));
		expect(await futureResult).to.equal(value);
	});

	it("should be able to set multiple values in scope", async () => {
		const key1 = randomUUID();
		const key2 = randomUUID();
		const value1 = randomUUID();
		const value2 = randomUUID();
		const futureFooBar = declareScope(() => Promise.resolve()
			.then(() => bind(key1, value1))
			.then(() => bind(key2, value2))
			.then(() => Promise.all([access(key1), access(key2)])));
		expect(await futureFooBar).to.deep.equal([value1, value2]);
	});

	it("should inherit scope from outer scope", async () => {
		const key = randomUUID();
		const value = randomUUID();
		await bind(key, value);
		const result = await declareScope(() => access(key));
		expect(result).to.equal(value);
		const nestedResult = await declareScope(() => declareScope(() => access(key)));
		expect(nestedResult).to.equal(value);
	})

	it("should not mutate global scope", async () => {
		const id = randomUUID();
		const nestedValue = randomUUID();
		const value = randomUUID();
		await bind(id, value);
		const nestedResult = await declareScope(() => bind(id, nestedValue).then(() => access(id)));
		expect(nestedResult).to.equal(nestedValue);
		expect(await access(id)).to.equal(value);
	});

	it("should not mutate a nested scope from an even more nested scope", async () => {
		const id = randomUUID();
		const value = randomUUID();
		const nestedValue = randomUUID();
		const result = await declareScope(async () => {
			await bind(id, value);
			const futureNestedResult = declareScope(() => bind(id, nestedValue).then(() => access(id)));
			const futureResult = access(id);
			return Promise.all([futureResult, futureNestedResult]);
		});
		expect(result).to.deep.equal([value, nestedValue]);
	});

	it("should not let concurrently mutated scopes affect each other", async () => {
		const trace = [];
		const futureA = declareScope(
			() => bind("key", "foo")
				.then(() => trace.push("a set"))
				.then(() => sleep(20))
				.then(() => access("key"))
				.then((res) => {
					trace.push("a get");
					return res;
				})
		);
		const futureB = declareScope(
			() => sleep(10)
				.then(() => bind("key", "bar"))
				.then(() => trace.push("b set"))
				.then(() => sleep(15))
				.then(() => access("key"))
				.then((res) => {
					trace.push("b get");
					return res;
				})
		);
		const [a, b] = await Promise.all([futureA, futureB]);
		expect(trace).to.deep.equal([
			"a set",
			"b set",
			"a get",
			"b get",
		]);
		expect(a).to.deep.equal("foo");
		expect(b).to.deep.equal("bar");
	});

	it("should support the method decorator", async () => {
		class Entry {
			constructor(private key: string, private value: string) {}
			@scopedMethod
			public async point(): Promise<string> {
				await bind(this.key, this.value);
				return this.bar();
			}

			private bar(): Promise<string> {
				return access(this.key);
			}
		}

		const id = randomUUID();
		const value = randomUUID();
		const nestedValue = randomUUID();
		await bind(id, value);
		expect(await new Entry(id, nestedValue).point()).to.equal(nestedValue);
		expect(await access(id)).to.equal(value);
	});

	it("should support the function decorator", async () => {
		const entryPoint = scopedFunction(async (key: string, value: string) => {
			await bind(key, value);
			return helper(key);
		});

		const helper = (key: string) => {
			return access(key);
		};

		const id = randomUUID();
		const value = randomUUID();
		const nestedValue = randomUUID();
		await bind(id, value);
		expect(await entryPoint(id, nestedValue)).to.equal(nestedValue);
		expect(await access(id)).to.equal(value);
	});
});
