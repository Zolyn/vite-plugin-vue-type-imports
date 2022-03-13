type Foo = [[number, number]];
type Bar = Foo;

export interface Props<T> {
    foo: Foo;
    bar: Bar;
}

export interface Test {};
