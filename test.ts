const code = `type A = {} & {};

export interface InputProps extends A<A> {
  prop: string;


  props: string;
}`;

console.log(code.slice(61, 97));
