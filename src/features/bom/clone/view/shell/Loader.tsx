import React from 'react'

export function Loader(props: { label: string }): React.JSX.Element {
  const { label } = props
  return (
    <div className="plm-extension-bom-clone-loading-center">
      <div className="generic-loader plm-extension-loader">
        <div className="bounce1" />
        <div className="bounce2" />
        <div className="bounce3" />
      </div>
      <div className="plm-extension-bom-clone-loading-text">{label}</div>
    </div>
  )
}
