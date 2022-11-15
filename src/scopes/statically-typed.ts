import scopes from "./proper";

enum Identifiers {
	Foo = "foo",
	Bar = "bar",
}

type ValueTypes = {
	[Identifiers.Foo]: string;
	[Identifiers.Bar]: number;
}

type Binder = <I extends Identifiers>(identifier: I, value: ValueTypes[I]) => ValueTypes[I];
type Accessor = <I extends Identifiers>(identifier: I) => ValueTypes[I];
type Mutator = <I extends Identifiers>(identifier: I, value: ValueTypes[I]) => ValueTypes[I];

const bind: Binder = scopes.bind;
const access = scopes.access as Accessor;
const mutate: Mutator = scopes.mutate;

export default {bind, access, mutate};
