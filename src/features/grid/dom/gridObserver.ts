export function createGridObserver(onChange: () => void): MutationObserver {
  const observer = new MutationObserver(() => onChange())
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'id']
  })
  return observer
}
