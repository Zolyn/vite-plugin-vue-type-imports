import { Color, Size } from './other-types';
export { ButtonProps } from './other-types';

type A = {} & {};

export interface InputProps extends A {
    name: Color;
}

export interface ButtonEmits {
    (e: 'click'): void;
}
