import scopes from "./dynamically-typed";

enum Identifiers {
	Foo = "foo",
	Bar = "bar",
	Baz = "baz",
}

type ValueTypes = {
	[Identifiers.Foo]: string;
	[Identifiers.Bar]: number;
	[Identifiers.Baz]: {foobar: boolean};
}

type Predicates = {[identifier in Identifiers]?: (value: unknown) => value is ValueTypes[identifier]};

const predicates: Predicates = {
	[Identifiers.Baz]: (value: unknown): value is {foobar: boolean} =>
		typeof value === "object" && ("foobar" in value) && typeof value.foobar === "boolean",
};

const bind: <I extends Identifiers>(identifier: I, value: ValueTypes[I]) => ValueTypes[I] = (identifier, value) =>
	scopes.bind(identifier, value, predicates[identifier]);
const access: <I extends Identifiers>(identifier: I) => ValueTypes[I] = scopes.access;
const mutate: <I extends Identifiers>(identifier: I, value: ValueTypes[I]) => ValueTypes[I] = scopes.mutate;

export default {bind, access, mutate};
