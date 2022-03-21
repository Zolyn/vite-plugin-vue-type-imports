import { MoreColors } from '~/test';

export enum Size {
    Small = 'small',
    Medium = 'medium',
    Large = 'large',
}

export type Color = 'blue' | 'red' | MoreColors;

export interface ButtonProps {
    color: Color;
    size: Size;
}
