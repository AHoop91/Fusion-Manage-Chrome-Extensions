import React from 'react'
import { ensureGenericLoaderStyles } from './genericLoader.styles'

export type GenericLoaderProps = {
  label: string
  compact?: boolean
  inline?: boolean
  className?: string
  labelClassName?: string
  labelRef?: React.Ref<HTMLSpanElement>
}

export function GenericLoader(props: GenericLoaderProps): React.JSX.Element {
  const { label, compact = false, inline = false, className, labelClassName, labelRef } = props
  ensureGenericLoaderStyles()

  const rootClassName = [
    'plm-extension-generic-loader',
    compact ? 'plm-extension-generic-loader--compact' : '',
    inline ? 'plm-extension-generic-loader--inline' : '',
    className ?? ''
  ].filter(Boolean).join(' ')

  const labelClasses = [
    'plm-extension-generic-loader__label',
    labelClassName ?? ''
  ].filter(Boolean).join(' ')

  return (
    <div className={rootClassName} role="status" aria-live="polite">
      <div className="plm-extension-generic-loader__dots" aria-hidden="true">
        <span className="plm-extension-generic-loader__dot" />
        <span className="plm-extension-generic-loader__dot" />
        <span className="plm-extension-generic-loader__dot" />
      </div>
      <span ref={labelRef} className={labelClasses}>{label}</span>
    </div>
  )
}
