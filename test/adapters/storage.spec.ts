import {expect} from "chai";
import storage from "../../src/adapters/storage";

const getFromStorage = async (key: string): Promise<string> => storage.get(key);

const addToStorage = async (key: string, value: string): Promise<void> => {
	storage.set(key, value);
};

describe("storage", () => {

	it("should not have anything in scope from the beginning", async () => {
		expect(await getFromStorage("key")).to.not.exist;
		expect(await Promise.resolve().then(() => getFromStorage("key"))).to.not.exist;
	});

	it("should be able to set values in scope", async () => {
		const futureFoo = Promise.resolve()
			.then(() => addToStorage("key", "foo"))
			.then(() => getFromStorage("key"));
		expect(await futureFoo).to.equal("foo");
		const futureBar = Promise.resolve()
			.then(() => addToStorage("otherKey", "bar"))
			.then(() => getFromStorage("otherKey"));
		expect(await futureBar).to.equal("bar");
	});

	it("should be able to set multiple values in scope", async () => {
		const futureFooBar = Promise.resolve()
			.then(() => addToStorage("foo", "foo"))
			.then(() => addToStorage("bar", "bar"))
			.then(() => Promise.all([getFromStorage("foo"), getFromStorage("bar")]));
		expect(await futureFooBar).to.deep.equal(["foo", "bar"]);
	});
});
