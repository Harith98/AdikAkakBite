/**
 * A template (unlike a layout) re-mounts on every navigation, so each page
 * plays the short fade-up in globals.css (.page-enter) when it opens.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>
}
