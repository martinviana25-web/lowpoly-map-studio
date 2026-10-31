import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore.ts';

/** Ctrl+Z deshace; Ctrl+Y y Ctrl+Shift+Z rehacen; Delete/Backspace borra el elemento seleccionado. */
export function useShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const t = event.target;
        const typing =
          t instanceof HTMLTextAreaElement ||
          t instanceof HTMLSelectElement ||
          (t instanceof HTMLInputElement && t.type !== 'range' && t.type !== 'checkbox' && t.type !== 'color');
        const { selectedPropId, deleteProp } = useEditorStore.getState();
        if (typing || !selectedPropId) return;
        deleteProp(selectedPropId);
        event.preventDefault();
        return;
      }
      if (!event.ctrlKey && !event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLInputElement && target.type !== 'range' && target.type !== 'checkbox' && target.type !== 'color') {
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
