import React from 'react'
import { GenericLoader } from '../../../../../shared/generic-loader'

export function Loader(props: { label: string }): React.JSX.Element {
  const { label } = props
  return <GenericLoader label={label} className="plm-extension-bom-clone-loading-center" />
}
