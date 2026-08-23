export type ButtonSize = 'sm' | 'md' | 'lg'
export type ButtonVariant = 'primary' | 'secondary'
export interface ButtonProps extends React.ComponentPropsWithoutRef<'button'> {
  size?: ButtonSize
  variant?: ButtonVariant
}
