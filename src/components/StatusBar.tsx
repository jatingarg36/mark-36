import { Experiments, isEnabled } from "../config/experiments";

export function StatusBar({ content }: { content: string }) {
  if (!isEnabled(Experiments.QOL_FEATURES)) return null;

  const chars = content.length;
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const readTime = Math.ceil(words / 200);

  return (
    <div 
      className="status-bar" 
      style={{ 
        display: 'flex', 
        gap: '16px', 
        padding: '6px 16px', 
        fontSize: '12px', 
        borderTop: '1px solid var(--border-color)', 
        color: 'var(--text-secondary)',
        backgroundColor: 'var(--bg-secondary)',
        justifyContent: 'center',
        flexShrink: 0
      }}
    >
      <span>{words} words</span>
      <span>{chars} characters</span>
      <span>{readTime} min read</span>
    </div>
  );
}
