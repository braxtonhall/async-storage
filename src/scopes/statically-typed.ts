import scopes from ".//proper-scopes";

enum Identifiers {
	Foo = "foo",
	Bar = "bar",
}

type ValueTypes = {
	[Identifiers.Foo]: string;
	[Identifiers.Bar]: number;
}

const bind: <I extends Identifiers>(identifier: I, value: ValueTypes[I]) => ValueTypes[I] = scopes.bind;
const access: <I extends Identifiers>(identifier: I) => ValueTypes[I] = scopes.access;
const mutate: <I extends Identifiers>(identifier: I, value: ValueTypes[I]) => ValueTypes[I] = scopes.mutate;

export default {bind, access, mutate};
