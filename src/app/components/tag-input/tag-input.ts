import { Component, ElementRef, input, model, viewChild } from '@angular/core';

/**
 * Input de etiquetas: Enter agrega, Backspace (con el input vacío) quita la última,
 * pegar texto separado por comas agrega varias, doble clic edita una etiqueta.
 */
@Component({
  selector: 'app-tag-input',
  templateUrl: './tag-input.html',
  styleUrl: './tag-input.scss',
})
export class TagInput {
  readonly tags = model<string[]>([]);
  readonly placeholder = input('Escribe y presiona Enter...');
  /** `compact` es la variante usada en las lecciones del temario. */
  readonly compact = input(false);

  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('tagInput');

  focus(): void {
    this.input().nativeElement.focus();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const el = this.input().nativeElement;
    if (event.key === 'Enter') {
      event.preventDefault();
      const val = el.value.trim();
      if (val) {
        this.tags.update((t) => [...t, val]);
        el.value = '';
      }
    } else if (event.key === 'Backspace' && el.value === '' && this.tags().length > 0) {
      this.tags.update((t) => t.slice(0, -1));
    }
  }

  protected onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const paste = event.clipboardData?.getData('text');
    if (paste) {
      const newTags = paste.split(',').map((t) => t.trim()).filter((t) => t);
      this.tags.update((t) => [...t, ...newTags]);
      this.input().nativeElement.value = '';
    }
  }

  protected startEdit(event: MouseEvent): void {
    event.stopPropagation();
    const el = event.target as HTMLElement;
    el.contentEditable = 'true';
    el.classList.add('editing');
    el.focus();
    document.execCommand('selectAll', false);
  }

  protected finishEdit(event: FocusEvent, index: number): void {
    const el = event.target as HTMLElement;
    el.contentEditable = 'false';
    el.classList.remove('editing');
    const text = (el.textContent || '').trim();
    if (text) {
      if (text !== this.tags()[index]) {
        this.tags.update((t) => t.map((tag, i) => (i === index ? text : tag)));
      }
    } else {
      this.remove(index);
    }
  }

  protected onEditKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      (event.target as HTMLElement).blur();
    }
  }

  protected remove(index: number, event?: Event): void {
    event?.stopPropagation();
    this.tags.update((t) => t.filter((_, i) => i !== index));
  }
}
