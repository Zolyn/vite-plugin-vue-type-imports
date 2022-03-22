import { MoreColors, BaseProps } from '~/test';

export enum Size {
    Small = 'small',
    Medium = 'medium',
    Large = 'large',
}

export type Color = 'blue' | 'red' | MoreColors;

// interface BaseProps {
//     base: boolean;
// }

interface Props extends BaseProps {
    msg: string;
}

export interface ButtonProps {
    color: Color;
    size: Props;
}
