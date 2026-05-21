export const querySelectorShadow = (root: Document | ShadowRoot | Element, selector: string): HTMLElement | null => {
  const el = root.querySelector(selector) as HTMLElement | null;
  if (el) return el;
  const allChildren = Array.from(root.querySelectorAll('*'));
  for (const child of allChildren) {
    if (child.shadowRoot) {
      const found = querySelectorShadow(child.shadowRoot, selector);
      if (found) return found;
    }
  }
  return null;
};

export const querySelectorAllShadow = (root: Document | ShadowRoot | Element, selector: string): HTMLElement[] => {
  let results = Array.from(root.querySelectorAll(selector)) as HTMLElement[];
  const allChildren = Array.from(root.querySelectorAll('*'));
  for (const child of allChildren) {
    if (child.shadowRoot) {
      results = results.concat(querySelectorAllShadow(child.shadowRoot, selector));
    }
  }
  return results;
};

export const getActiveInputElements = (): { input: HTMLElement | null, getVal: () => string, setVal: (val: string) => void } => {
  const host = window.location.hostname;
  let input: HTMLElement | null = null;
  let getVal = () => '';
  let setVal = (_val: string) => {};

  const isVisible = (el: HTMLElement): boolean => {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  };

  const applyElement = (el: HTMLElement) => {
    input = el;
    if (el.tagName === 'TEXTAREA') {
      getVal = () => (el as HTMLTextAreaElement).value;
      setVal = (val: string) => {
        (el as HTMLTextAreaElement).value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
    } else if (el.isContentEditable || el.hasAttribute('contenteditable')) {
      getVal = () => el.innerText || el.textContent || '';
      setVal = (val: string) => {
        el.innerText = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
    }
  };

  const tryActiveElement = () => {
    const active = document.activeElement as HTMLElement | null;
    if (active && (active.tagName === 'TEXTAREA' || active.isContentEditable || active.hasAttribute('contenteditable'))) {
      applyElement(active);
      return true;
    }
    return false;
  };

  if (host.includes('claude.ai')) {
    const elements = querySelectorAllShadow(document, '[data-testid="prompt-input"], [contenteditable="true"]');
    const el = elements.find(isVisible) as HTMLElement || elements[0];
    if (el) {
      applyElement(el);
    }
  } else if (host.includes('chatgpt.com') || host.includes('chat.openai.com')) {
    const elements = querySelectorAllShadow(document, '#prompt-textarea');
    const el = elements.find(isVisible) as HTMLElement || elements[0];
    if (el) {
      applyElement(el);
    }
  } else if (host.includes('gemini.google.com')) {
    const elements = querySelectorAllShadow(document, 'rich-textarea div[contenteditable="true"], [aria-label*="Message Gemini"], div[contenteditable="true"]');
    const el = elements.find(isVisible) as HTMLElement || elements[0];
    if (el) {
      applyElement(el);
    }
  } else if (host.includes('arena.ai') || host.includes('lmarena.ai') || host.includes('lmsys.org')) {
    const elements = querySelectorAllShadow(document, 'textarea[placeholder*="Enter message"], [data-testid="textbox"] textarea, textarea');
    const el = elements.find(isVisible) as HTMLElement || elements[0];
    if (el) {
      applyElement(el);
    }
  } else {
    // Generic fallback for testing
    const textareas = Array.from(document.querySelectorAll('textarea')) as HTMLElement[];
    const el = textareas.find(isVisible) || textareas[textareas.length - 1];
    if (el) {
      applyElement(el);
    }
  }

  if (!input) {
    tryActiveElement();
  }

  return { input, getVal, setVal };
};