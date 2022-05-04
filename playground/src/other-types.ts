import { MoreColors, BaseProps } from '~/test';

export enum Size {
    Small = 'small',
    Medium = 'medium',
    Large = 'large',
}

export type Color = 'blue' | 'red' | MoreColors;

interface BaseProps {
    base: any;
}

interface Props extends BaseProps {
    msg: string;
    base: false;
}

export interface ButtonProps extends Props {
    color: Color;
    co: Color;
    size: BaseProps;
}
