import { useEffect } from 'react';
import { Scene } from './scene/Scene';
import { Topbar } from './ui/Topbar';
import { SidePanel } from './ui/SidePanel';
import { HoverTooltip } from './ui/HoverTooltip';
import { Legend } from './ui/Legend';
import { useAppStore } from './store/useAppStore';

export default function App() {
  const clearSelection = useAppStore((s) => s.clearSelection);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clearSelection]);

  return (
    <div className="app">
      <div className="canvas-host">
        <Scene />
      </div>
      <Topbar />
      <SidePanel />
      <Legend />
      <HoverTooltip />
    </div>
  );
}
