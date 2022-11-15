import {expect} from "chai";
import scopes, {declareScope, scoped} from "../../src/decorators/naive-scopes";
import {sleep} from "../../src/util/sleep";
import {randomUUID} from "crypto";

const get = async (key: string): Promise<string> => scopes.get(key);
const set = async (key: string, value: string): Promise<string> => scopes.set(key, value);

describe("scopes", () => {

	it("should not have anything in storage from the beginning", async () => {
		expect(await get("key")).to.not.exist;
		expect(await declareScope(() => Promise.resolve().then(() => get("key")))).to.not.exist;
	});

	it("should be able to set values in scope", async () => {
		const futureFoo = declareScope(() => Promise.resolve()
			.then(() => set("key", "foo"))
			.then(() => get("key")));
		expect(await futureFoo).to.equal("foo");
		const futureBar = declareScope(() => Promise.resolve()
			.then(() => set("otherKey", "bar"))
			.then(() => get("otherKey")));
		expect(await futureBar).to.equal("bar");
	});

	it("should be able to set multiple values in scope", async () => {
		const futureFooBar = declareScope(() => Promise.resolve()
			.then(() => set("foo", "foo"))
			.then(() => set("bar", "bar"))
			.then(() => Promise.all([get("foo"), get("bar")])));
		expect(await futureFooBar).to.deep.equal(["foo", "bar"]);
	});

	it("should inherit scope from outer scope", async () => {
		await set("key", "foo");
		const foo = await declareScope(() => get("key"));
		expect(foo).to.equal("foo");
		await set("key", "bar");
		const bar = await declareScope(() => declareScope(() => get("key")));
		expect(bar).to.equal("bar");
	})

	it("should not mutate outer scope", async () => {
		const id = randomUUID();
		const foo = await declareScope(() => set(id, "foo").then(() => get(id)));
		const result = await get(id);
		expect(foo).to.equal("foo");
		expect(result).to.not.exist;

		let baz;
		const bar = await declareScope(async () => {
			await set(id, "bar");
			baz = await declareScope(() => set(id, "baz").then(() => get(id)));
			return get(id);
		});
		expect(bar).to.equal("bar");
		expect(baz).to.equal("baz");
	});

	it("should not let concurrently mutated scopes affect each other", async () => {
		const trace = [];
		const futureA = declareScope(
			() => set("key", "foo")
				.then(() => trace.push("a set"))
				.then(() => sleep(20))
				.then(() => get("key"))
				.then((res) => {
					trace.push("a get");
					return res;
				})
		);
		const futureB = declareScope(
			() => sleep(10)
				.then(() => set("key", "bar"))
				.then(() => trace.push("b set"))
				.then(() => sleep(15))
				.then(() => get("key"))
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
			constructor(private key: string) {}
			@scoped
			public async point(): Promise<string> {
				await set(this.key, "foo");
				return this.bar();
			}

			private bar(): Promise<string> {
				return get(this.key);
			}
		}

		const id = randomUUID();
		const foo = await new Entry(id).point();
		expect(foo).to.equal("foo");
		expect(await get(id)).to.not.exist;
	});
});
