import {expect} from "chai";
import scopes, {declareScope, scopedFunction, scopedMethod} from "../../src/scopes/proper";
import {sleep} from "../../src/util/sleep";
import {randomUUID} from "crypto";

const access = async (key: string): Promise<string> => scopes.access(key);
const bind = async (key: string, value: string): Promise<string> => scopes.bind(key, value);
const mutate = async (key: string, value: string): Promise<string> => scopes.mutate(key, value);

describe("scopes", () => {

	it("should not have anything in global scope from the beginning", async () => {
		/**
		 * foo; // unbound identifier!
		 */
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
		/**
		 * {
		 *     foo; // unbound identifier!
		 * }
		 */
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
		/**
		 * foo = "bar"; // unbound identifier!
		 */
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
		/**
		 * {
		 *     foo = "bar"; // unbound identifier!
		 * }
		 */
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

	it("should be able to bind values in global scope", async () => {
		/**
		 * let foo = "bar";
		 * foo; // "bar"
		 */
		const key = randomUUID();
		const value = randomUUID();
		await bind(key, value);
		expect(await access(key)).to.equal(value);
	});

	it("should be able to bind values in nested scope", async () => {
		/**
		 * {
		 *     let foo = "bar";
		 *     foo; // "bar"
		 * }
		 */
		const key = randomUUID();
		const value = randomUUID();
		const futureResult = declareScope(() => Promise.resolve()
			.then(() => bind(key, value))
			.then(() => access(key)));
		expect(await futureResult).to.equal(value);
	});

	it("should be able to set multiple values in scope", async () => {
		/**
		 * {
		 *     let A = "a";
		 *     let B = "b";
		 *     A; // "a"
		 *     B; // "b"
		 * }
		 */
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
		/**
		 * let foo = "bar";
		 * {
		 *     foo; // "bar"
		 * }
		 * {
		 *     {
		 *         foo; // "bar"
		 *     }
		 * }
		 */
		const key = randomUUID();
		const value = randomUUID();
		await bind(key, value);
		const result = await declareScope(() => access(key));
		expect(result).to.equal(value);
		const nestedResult = await declareScope(() => declareScope(() => access(key)));
		expect(nestedResult).to.equal(value);
	})

	it("should not mutate global scope through binding (shadowing)", async () => {
		/**
		 * let foo = "bar";
		 * {
		 *     let foo = "baz";
		 *     foo; // "baz"
		 * }
		 * foo; // "bar"
		 */
		const id = randomUUID();
		const nestedValue = randomUUID();
		const value = randomUUID();
		await bind(id, value);
		const nestedResult = await declareScope(() => bind(id, nestedValue).then(() => access(id)));
		expect(nestedResult).to.equal(nestedValue);
		expect(await access(id)).to.equal(value);
	});

	it("should not mutate a nested scope from an even more nested scope through binding", async () => {
		/**
		 * {
		 *     let foo = "bar";
		 *     {
		 *         let foo = "baz";
		 *         foo; // "baz"
		 *     }
		 *     foo; // "bar"
		 * }
		 */
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

	it("should be able to mutate bindings in the global scope", async () => {
		/**
		 * let foo = "bar";
		 * foo = "baz";
		 * foo; // "baz"
		 */
		const key = randomUUID();
		const value = randomUUID();
		const newValue = randomUUID();
		await bind(key, value);
		await mutate(key, newValue);
		expect(await access(key)).to.equal(newValue);
	});

	it("should be able to mutate bindings in a nested scope", async () => {
		/**
		 * {
		 *     let foo = "bar";
		 *     foo = "baz";
		 *     foo; // "baz"
		 * }
		 */
		const key = randomUUID();
		const value = randomUUID();
		const newValue = randomUUID();
		const result = await declareScope(async () => {
			await bind(key, value);
			await mutate(key, newValue);
			return access(key);
		});
		expect(result).to.equal(newValue);
	});

	it("should cascade mutations down to nested scopes", async () => {
		/**
		 * let foo = "bar";
		 * concurrently(foo = "baz", {foo;}); // "baz"
		 */
		const trace = [];
		await bind("key", "foo");
		trace.push("outer set foo");

		const innerScope = declareScope(
			() => sleep(0)
				.then(() => trace.push("inner start"))
				.then(() => sleep(10))
				.then(() => access("key"))
				.then((res) => {
					trace.push("inner get");
					return res;
				})
		);

		const outerScope = sleep(5)
			.then(() => mutate("key", "bar"))
			.then(() => trace.push("outer set bar"));

		const [inner] = await Promise.all([innerScope, outerScope]);
		expect(trace).to.deep.equal([
			"outer set foo",
			"inner start",
			"outer set bar",
			"inner get",
		]);
		expect(inner).to.equal("bar");
	});

	it("should be able to mutate global scope from nested scope if an identifier is not shadowed", async () => {
		/**
		 * let foo = "bar";
		 * {
		 *     foo = "baz";
		 * }
		 * foo; // "baz"
		 */
		const id = randomUUID();
		const value = randomUUID();
		const newValue = randomUUID();
		const newNewValue = randomUUID();
		await bind(id, value);
		await declareScope(() => mutate(id, newValue));
		expect(await access(id)).to.equal(newValue);
		await declareScope(() => declareScope(() => mutate(id, newNewValue)));
		expect(await access(id)).to.equal(newNewValue);
	});

	it("should be able to mutate nested scope from more nested scope if an identifier is not shadowed", async () => {
		/**
		 * let foo = "bar";
		 * {
		 *     let foo = "baz";
		 *     {
		 *         foo = "foobar";
		 *     }
		 *     foo; // "foobar"
		 * }
		 * foo; // "bar"
		 */
		const id = randomUUID();
		const value = randomUUID();
		const newValue = randomUUID();
		const newNewValue = randomUUID();
		await bind(id, value);
		const result = await declareScope(async () => {
			await bind(id, newValue);
			await declareScope(async () => mutate(id, newNewValue));
			return access(id);
		});
		expect(result).to.equal(newNewValue);
		expect(await access(id)).to.equal(value);
	});

	it("should not let concurrently mutated scopes affect each other", async () => {
		/**
		 * concurrently(
		 *     {
		 *         let foo = "bar"
		 *         foo; // "bar"
		 *     },
		 *     {
		 *         let foo = "baz"
		 *         foo; // "baz"
		 *     },
		 * )
		 */
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
			constructor(private key: string, private value: string) {
			}

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
