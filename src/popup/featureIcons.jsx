/**
 * Stroke icons for build-feature rows (24×24 viewBox, ~22px rendered).
 * @param {{ name: string; className?: string; title?: string }} props
 */
export function FeatureIcon({ name, className = '', title }) {
    const svgProps = {
        className: `feature-icon-svg ${className}`.trim(),
        width: 22,
        height: 22,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.65,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': title ? undefined : true,
        role: title ? 'img' : undefined,
        ...(title ? { 'aria-label': title } : {})
    }

    switch (name) {
        case 'document':
            return (
                <svg {...svgProps}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                    <path d="M16 13H8M16 17H8M10 9H8" />
                </svg>
            )
        case 'filter':
            return (
                <svg {...svgProps}>
                    <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
                </svg>
            )
        case 'pencil':
            return (
                <svg {...svgProps}>
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                </svg>
            )
        case 'table':
            return (
                <svg {...svgProps}>
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
                </svg>
            )
        case 'arrowDownTray':
            return (
                <svg {...svgProps}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <path d="m7 10 5 5 5-5M12 15V3" />
                </svg>
            )
        case 'arrowUpTray':
            return (
                <svg {...svgProps}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <path d="m7 8 5-5 5 5M12 3v12" />
                </svg>
            )
        case 'arrowDownCircle':
            return (
                <svg {...svgProps}>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v8M9 13l3 3 3-3" />
                </svg>
            )
        case 'viewColumns':
            return (
                <svg {...svgProps}>
                    <path d="M4 4h16v16H4z" />
                    <path d="M9 4v16M15 4v16" />
                </svg>
            )
        case 'layers':
            return (
                <svg {...svgProps}>
                    <path d="M12 2 2 7l10 5 10-5-10-5z" />
                    <path d="M2 12 12 17l10-5" />
                    <path d="M2 17 12 22l10-5" />
                </svg>
            )
        case 'cube':
            return (
                <svg {...svgProps}>
                    <path d="M12 2 21 7v10l-9 5-9-5V7l9-5z" />
                    <path d="M12 22V12" />
                    <path d="m21 7-9 5-9-5" />
                </svg>
            )
        default:
            return (
                <svg {...svgProps}>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v4M12 16h.01" />
                </svg>
            )
    }
}
