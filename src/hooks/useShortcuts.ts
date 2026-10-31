import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore.ts';

/** Ctrl+Z deshace; Ctrl+Y y Ctrl+Shift+Z rehacen. Respeta los campos de texto. */
export function useShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLInputElement && target.type !== 'range' && target.type !== 'checkbox') {
        return;
      }
      const key = event.key.toLowerCase();
      const { undo, redo } = useEditorStore.getState();
      if (key === 'z' && !event.shiftKey) undo();
      else if (key === 'y' || (key === 'z' && event.shiftKey)) redo();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
