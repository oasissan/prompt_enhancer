import { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import { getStorageData, updateStorageData, StorageData, Template } from './storage'
import { getActiveInputElements, querySelectorShadow, querySelectorAllShadow } from './platformSelectors'

// ============================================================================
// EARLY MODULE-SCOPE EVENT INTERCEPTOR
// Registered before ChatGPT's scripts load (via run_at: document_start).
// This ensures our capture-phase listener fires FIRST on window.
// We store a mutable callback ref that the React app updates later.
// ============================================================================
const __refinerCallbackRef: { current: (() => void) | null } = { current: null };
const __refinerLoadingRef: { current: boolean } = { current: false };

const __isRefinerButton = (e: Event): boolean => {
  // Check composedPath for refiner button or wrapper
  const path = (e as any).composedPath ? (e as any).composedPath() : [];
  for (const node of path) {
    if (node && node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.getAttribute) {
        if (el.getAttribute('data-refiner-button') === 'true') return true;
        if (el.getAttribute('data-refiner-wrapper') === 'true') return true;
      }
      if (el.classList && el.classList.contains('ai-prompt-refiner-inline-wrapper')) return true;
    }
  }
  // Geometric fallback
  if (e instanceof MouseEvent) {
    const x = e.clientX;
    const y = e.clientY;
    const btns = Array.from(document.querySelectorAll('[data-refiner-button="true"]')) as HTMLElement[];
    for (const btn of btns) {
      const rect = btn.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 &&
          x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return true;
      }
    }
    const wrappers = Array.from(document.querySelectorAll('.ai-prompt-refiner-inline-wrapper')) as HTMLElement[];
    for (const wrapper of wrappers) {
      const rect = wrapper.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 &&
          x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return true;

      }
    }
  }
  return false;
};

const __earlyGlobalHandler = (e: Event) => {
  if (!__isRefinerButton(e)) return;
  const canHandle = !!__refinerCallbackRef.current && !__refinerLoadingRef.current;
  if (!canHandle) return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  if (e.type === 'pointerdown' || e.type === 'mousedown' || e.type === 'click') {
    __refinerCallbackRef.current?.();
  }
};

// Register IMMEDIATELY at module parse time — before ChatGPT's scripts
(['pointerdown', 'mousedown', 'click', 'mouseup', 'pointerup'] as const).forEach(evtType => {
  window.addEventListener(evtType, __earlyGlobalHandler, { capture: true });
});

console.log("✨ Prompt Enhancer: Content script executing. document.readyState =", document.readyState);

const MASTER_TEMPLATE: Template = {
  id: 'master_enhance',
  name: 'AI Auto-Enhance',
  description: 'AI-optimized response quality booster',
  rule: 'Comprehensively enhance this prompt to maximize AI response quality. Clarify the language and sentence structure, add relevant context about the purpose and audience, specify the desired output format and length, rephrase the main request as a direct question where appropriate, and break any complex tasks into numbered steps. Preserve the original intent.',
  type: 'ai'
};

const isElementVisible = (el: HTMLElement): boolean => {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  return true;
};

const findContainerAndButtons = (inputEl: HTMLElement): { container: HTMLElement | null, plusBtn: HTMLElement | null, sendBtn: HTMLElement | null } => {
  let parent = inputEl.parentElement;
  const host = window.location.hostname;

  const getPlusInSubtree = (root: HTMLElement): HTMLElement | null => {
    if (host.includes('claude.ai')) {
      const btn = querySelectorShadow(root, 'button[aria-label*="Attach"], button[aria-label*="Add photos"], button[aria-label*="files"], button[aria-label*="Upload"], button[data-testid*="attachment"]') as HTMLElement;
      if (btn && isElementVisible(btn)) return btn;
    } else if (host.includes('gemini.google.com')) {
      const btn = querySelectorShadow(root, 'button[aria-label*="Add files"], button[aria-label*="Upload"], button[aria-label*="Attach"], button[class*="upload"]') as HTMLElement;
      if (btn && isElementVisible(btn)) return btn;
    } else if (host.includes('arena.ai') || host.includes('lmarena.ai') || host.includes('lmsys.org')) {
      const buttons = querySelectorAllShadow(root, 'button');
      for (const btn of buttons) {
        const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
        const aria = (btn.getAttribute('aria-label') || '').trim().toLowerCase();
        const className = (btn.className || '').trim().toLowerCase();
        if (
          text === '+' || text.includes('upload') || text.includes('attach') || text.includes('file') ||
          aria.includes('upload') || aria.includes('attach') || aria.includes('file') || aria === '+' ||
          className.includes('upload') || className.includes('attach')
        ) {
          if (isElementVisible(btn)) return btn;
        }
      }
    }
    
    // Heuristic A: Look for aria-label or title matching attach, upload, add, or "+"
    const ariaAttach = querySelectorShadow(root, 
      'button[aria-label*="Attach"], button[aria-label*="attach"], button[title*="Attach"], button[title*="attach"], ' +
      'button[aria-label*="Upload"], button[aria-label*="upload"], button[title*="Upload"], button[title*="upload"], ' +
      'button[aria-label*="Add"], button[aria-label*="add"], button[aria-label="+"]'
    ) as HTMLElement;
    if (ariaAttach && isElementVisible(ariaAttach)) return ariaAttach;

    // Heuristic B: Look for common attachment/plus/upload classes or IDs
    const commonSelectors = [
      'button[class*="upload"]', 'button[class*="attach"]', 'button[class*="plus"]',
      'button[id*="upload"]', 'button[id*="attach"]', 'button[id*="plus"]',
      '.upload-button', '.attach-button', '.file-upload', '.uploader',
      'button[aria-haspopup="menu"]'
    ];
    for (const selector of commonSelectors) {
      const el = querySelectorShadow(root, selector) as HTMLElement;
      if (el && isElementVisible(el)) return el;
    }
    
    return null;
  };

  const getSendInSubtree = (root: HTMLElement): HTMLElement | null => {
    if (host.includes('claude.ai')) {
      const btn = querySelectorShadow(root, 'button[data-testid="send-button"], button[aria-label*="Send Message"], button[aria-label*="Send message"]') as HTMLElement;
      if (btn && isElementVisible(btn)) return btn;
    } else if (host.includes('chatgpt.com') || host.includes('chat.openai.com')) {
      const btn = querySelectorShadow(root, 'button[data-testid="send-button"], button[aria-label*="Send prompt"], button[aria-label*="Send message"], button[class*="SendButton"]') as HTMLElement;
      if (btn && isElementVisible(btn)) return btn;
    } else if (host.includes('gemini.google.com')) {
      const btn = querySelectorShadow(root, 'button[aria-label*="Send message"], button[aria-label*="Send Message"], button.send-button, .send-button-container button, button[class*="send"]') as HTMLElement;
      if (btn && isElementVisible(btn)) return btn;
    } else if (host.includes('arena.ai') || host.includes('lmarena.ai') || host.includes('lmsys.org')) {
      const buttons = querySelectorAllShadow(root, 'button');
      for (const btn of buttons) {
        const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
        const aria = (btn.getAttribute('aria-label') || '').trim().toLowerCase();
        const id = (btn.id || '').trim().toLowerCase();
        if (text.includes('send') || text.includes('submit') || aria.includes('send') || aria.includes('submit') || id.includes('submit') || id.includes('send')) {
          if (isElementVisible(btn)) return btn;
        }
      }
    }
    
    // Heuristic A: Look for aria-label or title matching send / submit
    const ariaSubmit = querySelectorShadow(root, 'button[aria-label*="Send"], button[aria-label*="send"], button[title*="Send"], button[title*="send"], button[aria-label*="Submit"], button[title*="Submit"]') as HTMLElement;
    if (ariaSubmit && isElementVisible(ariaSubmit)) return ariaSubmit;

    // Heuristic B: Look for form submit button
    const formSubmit = querySelectorShadow(root, 'button[type="submit"]') as HTMLElement;
    if (formSubmit && isElementVisible(formSubmit)) return formSubmit;
    
    return null;
  };

  while (parent) {
    if (parent.parentNode && parent.parentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      parent = (parent.parentNode as ShadowRoot).host as HTMLElement;
      continue;
    }
    
    const plusBtn = getPlusInSubtree(parent);
    const sendBtn = getSendInSubtree(parent);
    
    if (plusBtn || sendBtn) {
      return { container: parent, plusBtn, sendBtn };
    }
    
    if (parent.tagName === 'BODY' || parent.tagName === 'HTML') {
      break;
    }
    parent = parent.parentElement;
  }
  
  return { container: null, plusBtn: null, sendBtn: null };
};


const App = () => {
  const [data, setData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [originalText, setOriginalText] = useState<string>('');
  const [inlineContainer, setInlineContainer] = useState<HTMLElement | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [inlineBtnRect, setInlineBtnRect] = useState<{left: number, top: number, width: number, height: number} | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLightTheme, setIsLightTheme] = useState(false);
  const [savedPromptsOpen, setSavedPromptsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const refineTriggerRef = useRef(0);
  const loadingRef = useRef(false);
  loadingRef.current = loading;
  __refinerLoadingRef.current = loading;

  useEffect(() => {
    getStorageData().then(setData);
  }, []);

  useEffect(() => {
    const checkTheme = () => {
      const htmlClass = document.documentElement.className || '';
      const bodyClass = document.body?.className || '';
      const dataTheme = document.documentElement.getAttribute('data-theme') || '';
      
      const hasLightWord = htmlClass.includes('light') || bodyClass.includes('light') || dataTheme.includes('light');
      const hasDarkWord = htmlClass.includes('dark') || bodyClass.includes('dark') || dataTheme.includes('dark');
      
      if (hasLightWord && !hasDarkWord) {
        setIsLightTheme(true);
      } else if (hasDarkWord) {
        setIsLightTheme(false);
      } else {
        setIsLightTheme(window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches);
      }
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    if (document.body) {
      observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    __refinerCallbackRef.current = triggerRefine;
    return () => {
      __refinerCallbackRef.current = null;
    };
  });

  useEffect(() => {
    const setupWrapperStyle = (wrapper: HTMLElement) => {
      wrapper.setAttribute('data-refiner-wrapper', 'true');
      wrapper.style.display = 'inline-flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.justifyContent = 'center';
      wrapper.style.verticalAlign = 'middle';
      wrapper.style.flexShrink = '0';
      wrapper.style.flexGrow = '0';
      wrapper.style.pointerEvents = 'auto';
      wrapper.style.position = 'relative';
      wrapper.style.zIndex = '2147483647';
      wrapper.style.isolation = 'isolate';
      wrapper.style.overflow = 'visible';
    };

    const injectButton = (wrapper: HTMLElement) => {
      if (wrapper.querySelector('[data-refiner-button="true"]')) return;
      
      const btn = document.createElement('button');
      btn.setAttribute('data-refiner-button', 'true');
      btn.setAttribute('type', 'button');
      btn.title = 'Optimize with Prompt Enhancer ✨';
      btn.textContent = '✨';
      
      Object.assign(btn.style, {
        width: '26px',
        height: '26px',
        borderRadius: '50%',
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '13px',
        color: isLightTheme ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.55)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        outline: 'none',
        padding: '0',
        marginLeft: '4px',
        marginRight: '4px',
        pointerEvents: 'auto',
        position: 'relative',
        zIndex: '2147483647',
        touchAction: 'manipulation',
        userSelect: 'none',
        boxShadow: 'none',
        lineHeight: '1',
        fontFamily: 'inherit',
      });

      const handleBtnClick = (evt: Event) => {
        if (loadingRef.current || !__refinerCallbackRef.current) return;
        evt.preventDefault();
        evt.stopPropagation();
        evt.stopImmediatePropagation();
        __refinerCallbackRef.current();
      };
      
      btn.addEventListener('pointerdown', handleBtnClick, { capture: true });
      btn.addEventListener('click', handleBtnClick, { capture: true });

      btn.addEventListener('mouseenter', () => {
        btn.style.backgroundColor = isLightTheme ? 'rgba(192, 132, 252, 0.15)' : 'rgba(192, 132, 252, 0.2)';
        btn.style.color = '#c084fc';
        btn.style.transform = 'scale(1.1)';
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.backgroundColor = 'transparent';
        btn.style.color = isLightTheme ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.55)';
        btn.style.transform = 'scale(1)';
      });

      wrapper.appendChild(btn);
    };

    const updateDOM = () => {
      const { input } = getActiveInputElements();
      if (!input) {
        if (inlineContainer !== null) {
          setInlineContainer(null);
        }
        document.querySelectorAll('.ai-prompt-refiner-inline-wrapper').forEach(w => w.remove());
        document.querySelectorAll('textarea, [contenteditable="true"]').forEach(el => {
          const orig = el.getAttribute('data-original-padding');
          if (orig !== null) {
            (el as HTMLElement).style.paddingLeft = orig;
            el.removeAttribute('data-original-padding');
          }
        });
        return;
      }

      const { plusBtn, sendBtn } = findContainerAndButtons(input);
      let activeWrapper: HTMLElement | null = null;

      if (plusBtn) {
        const parent = plusBtn.parentElement;
        if (parent) {
          let wrapper = Array.from(parent.children).find(c => (c as HTMLElement).classList.contains('ai-prompt-refiner-inline-wrapper')) as HTMLElement;
          if (wrapper) {
            setupWrapperStyle(wrapper);
          } else {
            wrapper = document.createElement('div');
            wrapper.className = 'ai-prompt-refiner-inline-wrapper';
            setupWrapperStyle(wrapper);
            parent.insertBefore(wrapper, plusBtn.nextSibling);
          }
          activeWrapper = wrapper;
        }
      } else if (sendBtn) {
        const parent = sendBtn.parentElement;
        if (parent) {
          let wrapper = Array.from(parent.children).find(c => (c as HTMLElement).classList.contains('ai-prompt-refiner-inline-wrapper')) as HTMLElement;
          if (wrapper) {
            setupWrapperStyle(wrapper);
          } else {
            wrapper = document.createElement('div');
            wrapper.className = 'ai-prompt-refiner-inline-wrapper';
            setupWrapperStyle(wrapper);
            parent.insertBefore(wrapper, sendBtn);
          }
          activeWrapper = wrapper;
        }
      }

      document.querySelectorAll('.ai-prompt-refiner-inline-wrapper').forEach(w => {
        if (w !== activeWrapper) w.remove();
      });

      if (activeWrapper) {
        injectButton(activeWrapper);
      }

      const host = window.location.hostname;
      if (input && plusBtn && activeWrapper) {
        if (!input.hasAttribute('data-original-padding')) {
          const currentPadding = window.getComputedStyle(input).paddingLeft;
          input.setAttribute('data-original-padding', currentPadding || '0px');
        }
        const origPaddingAttr = input.getAttribute('data-original-padding') || '0px';
        const origPadding = parseFloat(origPaddingAttr) || 0;
        
        // Only apply padding offset if the original padding is large (indicating absolute positioned overlay buttons).
        // If original padding is small, the buttons are inline in a flex container (e.g. new ChatGPT UI),
        // so the flex flow naturally pushes the input field without manual offsets.
        if (origPadding >= 30) {
          let offset = 30;
          if (host.includes('claude.ai')) {
            offset = 32;
          } else if (host.includes('gemini.google.com')) {
            offset = 36;
          }
          input.style.paddingLeft = `${origPadding + offset}px`;
        } else {
          input.style.paddingLeft = `${origPadding}px`;
        }
      } else if (input) {
        const origPadding = input.getAttribute('data-original-padding');
        if (origPadding !== null) {
          input.style.paddingLeft = origPadding;
          input.removeAttribute('data-original-padding');
        }
      }

      if (inlineContainer !== activeWrapper) {
        setInlineContainer(activeWrapper);
      }
    };

    updateDOM();
    const interval = setInterval(updateDOM, 1000);
    return () => clearInterval(interval);
  }, [inlineContainer, isLightTheme]);

  useEffect(() => {
    const updateAnchor = () => {
      const { input } = getActiveInputElements();
      let anchorEl: HTMLElement | null = null;
      if (input) {
        const { plusBtn, sendBtn } = findContainerAndButtons(input);
        anchorEl = plusBtn || sendBtn || input;
      }
      setAnchorRect(anchorEl ? anchorEl.getBoundingClientRect() : null);
    };
    updateAnchor();
    const interval = setInterval(updateAnchor, 1000);
    window.addEventListener('resize', updateAnchor);
    window.addEventListener('scroll', updateAnchor, true);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', updateAnchor);
      window.removeEventListener('scroll', updateAnchor, true);
    };
  }, []);

  useEffect(() => {
    if (!inlineContainer) {
      setInlineBtnRect(null);
      return;
    }
    let animationFrameId: number;
    let lastLeft = 0, lastTop = 0, lastWidth = 0, lastHeight = 0;

    const alignOverlay = () => {
      const btn = inlineContainer.querySelector('[data-refiner-button="true"]');
      if (btn) {
        const rect = btn.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          if (
            Math.abs(rect.left - lastLeft) > 0.5 ||
            Math.abs(rect.top - lastTop) > 0.5 ||
            Math.abs(rect.width - lastWidth) > 0.5 ||
            Math.abs(rect.height - lastHeight) > 0.5
          ) {
            lastLeft = rect.left;
            lastTop = rect.top;
            lastWidth = rect.width;
            lastHeight = rect.height;
            setInlineBtnRect({
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
            });
          }
        } else if (lastWidth !== 0) {
          lastLeft = lastTop = lastWidth = lastHeight = 0;
          setInlineBtnRect(null);
        }
      } else if (lastWidth !== 0) {
        lastLeft = lastTop = lastWidth = lastHeight = 0;
        setInlineBtnRect(null);
      }
      animationFrameId = requestAnimationFrame(alignOverlay);
    };

    animationFrameId = requestAnimationFrame(alignOverlay);
    return () => cancelAnimationFrame(animationFrameId);
  }, [inlineContainer]);

  const runRefineAPI = async () => {
    if (loading) return;
    const { input, getVal } = getActiveInputElements();
    const val = getVal();
    
    const triggerError = (msg: string) => {
      setOriginalText(val || '');
      setPreviewText('');
      setPreviewError(msg);
      setPreviewOpen(true);
    };

    if (!input) {
      triggerError('No prompt input detected on this page. Please click inside the chatbox.');
      return;
    }
    if (!val.trim()) {
      triggerError('Please type a prompt in the chatbox first, then click ✨ to optimize it.');
      return;
    }

    const provider = data?.preferredProvider || 'gemini';
    let apiKey = '';
    let providerName = 'Gemini';

    if (provider === 'gemini') {
      apiKey = data?.apiKey || '';
      providerName = 'Gemini';
    } else if (provider === 'openai') {
      apiKey = data?.openaiApiKey || '';
      providerName = 'OpenAI';
    } else if (provider === 'anthropic') {
      apiKey = data?.anthropicApiKey || '';
      providerName = 'Anthropic';
    }
    // gemini-web uses the browser session — no API key needed

    if (provider !== 'gemini-web' && !apiKey) {
      triggerError(`Please configure your ${providerName} API Key in the extension options.`);
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        if (chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        } else {
          window.open(chrome.runtime.getURL('options.html'));
        }
      } else {
        triggerError('Extension context was reloaded or updated. Please refresh this page to continue.');
      }
      return;
    }

    setOriginalText(val);
    setPreviewError(null);
    setPreviewText('');
    setPreviewOpen(true);
    setLoading(true);

    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      triggerError('Prompt Enhancer context was reloaded or updated. Please refresh this page to continue optimizing.');
      setLoading(false);
      return;
    }

    try {
      const response = await new Promise<any>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'refinePrompt',
            payload: {
              text: val,
              template: MASTER_TEMPLATE,
              provider,
              apiKey,
              model: data?.preferredModel,
            },
          },
          (res) => {
            const error = chrome.runtime.lastError;
            if (error) {
              reject(new Error(error.message));
              return;
            }
            resolve(res);
          }
        );
      });

      if (response && response.success) {
        setPreviewText(response.refinedText);
        setPreviewError(null);
      } else {
        setPreviewError(response?.error || 'Unknown error');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Extension context invalidated') || msg.includes('sendMessage')) {
        setPreviewError('Prompt Enhancer context was reloaded or updated. Please refresh this page to continue optimizing.');
      } else {
        setPreviewError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const triggerRefine = () => {
    const now = Date.now();
    if (now - refineTriggerRef.current < 500) return;
    refineTriggerRef.current = now;
    runRefineAPI();
  };

  const handleAccept = () => {
    if (previewText) {
      const { setVal } = getActiveInputElements();
      setVal(previewText);
    }
    setPreviewText(null);
    setPreviewError(null);
    setPreviewOpen(false);
  };

  const handleReject = () => {
    setPreviewText(null);
    setPreviewError(null);
    setPreviewOpen(false);
  };

  const handleCopy = () => {
    if (previewText) {
      navigator.clipboard.writeText(previewText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = async () => {
    if (!previewText || !data) return;
    setSaveStatus('saving');
    const currentSaved = data.savedPrompts || [];
    if (!currentSaved.includes(previewText)) {
      const updated = [previewText, ...currentSaved];
      await updateStorageData({ savedPrompts: updated });
      setData({ ...data, savedPrompts: updated });
    }
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleDeletePrompt = async (indexToDelete: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data) return;
    const currentSaved = data.savedPrompts || [];
    const updated = currentSaved.filter((_, i) => i !== indexToDelete);
    await updateStorageData({ savedPrompts: updated });
    setData({ ...data, savedPrompts: updated });
  };

  const handleClearAllPrompts = async () => {
    if (!data) return;
    if (window.confirm("Are you sure you want to clear all saved prompts?")) {
      await updateStorageData({ savedPrompts: [] });
      setData({ ...data, savedPrompts: [] });
    }
  };

  const handleCopySavedPrompt = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!data) return null;

  // Synchronous check to see if we have an active input with inline button capability.
  // This prevents the floating button from rendering/flashing when an inline button is available.
  const { input: activeInput } = getActiveInputElements();
  let hasInline = false;
  if (activeInput) {
    const { plusBtn, sendBtn } = findContainerAndButtons(activeInput);
    if (plusBtn || sendBtn) {
      hasInline = true;
    }
  }

  const spinnerStyles = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .refiner-spinner {
      animation: spin 1.2s linear infinite;
      display: inline-block;
      font-size: 14px;
    }
  `;

  const baseFloatingStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: isLightTheme ? '#f1f5f9' : '#1e293b',
    color: isLightTheme ? 'rgba(0, 0, 0, 0.65)' : 'rgba(255, 255, 255, 0.85)',
    border: isLightTheme ? '1px solid rgba(0, 0, 0, 0.12)' : '1px solid rgba(255, 255, 255, 0.16)',
    cursor: loading ? 'wait' : 'pointer',
    boxShadow: isLightTheme ? '0 2px 8px rgba(0, 0, 0, 0.08)' : '0 2px 10px rgba(0, 0, 0, 0.4)',
    fontSize: '15px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2147483647,
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    pointerEvents: 'auto',
    touchAction: 'manipulation',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const anchoredFloatingStyle: React.CSSProperties = (() => {
    if (!anchorRect) return baseFloatingStyle;
    const buttonWidth = 32;
    const padding = 8;
    let left = Math.round(anchorRect.right + padding);
    let top = Math.round(anchorRect.top + (anchorRect.height - buttonWidth) / 2);
    
    if (left + buttonWidth > window.innerWidth - 8) {
      left = Math.round(anchorRect.left - buttonWidth - padding);
    }
    
    left = Math.max(8, Math.min(left, window.innerWidth - buttonWidth - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - buttonWidth - 8));
    
    return {
      ...baseFloatingStyle,
      top: `${top}px`,
      left: `${left}px`,
      bottom: 'auto',
      right: 'auto',
    };
  })();

  const finalFloatingStyle: React.CSSProperties = {
    ...anchoredFloatingStyle,
    ...(isHovered && !loading ? {
      background: isLightTheme ? '#e2e8f0' : '#334155',
      borderColor: isLightTheme ? 'rgba(0, 0, 0, 0.18)' : 'rgba(255, 255, 255, 0.25)',
      transform: 'scale(1.05)',
    } : {})
  };

  const baseModalStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '80px',
    right: '30px',
    width: '460px',
    maxWidth: 'calc(100vw - 60px)',
    maxHeight: '80vh',
    backgroundColor: 'rgba(11, 12, 18, 0.96)',
    backdropFilter: 'blur(20px) saturate(120%)',
    border: '1px solid rgba(139, 92, 246, 0.25)',
    borderRadius: '16px',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(139, 92, 246, 0.15)',
    overflow: 'hidden',
    zIndex: 2147483647,
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#e2e8f0',
    animation: 'fadeInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
    display: 'flex',
    flexDirection: 'column',
  };

  const anchoredModalStyle: React.CSSProperties = (() => {
    if (!anchorRect) return baseModalStyle;
    const padding = 16;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const modalWidth = Math.min(460, screenWidth - padding * 2);
    
    let left: number | undefined;
    let right: number | undefined = padding;
    
    if (anchorRect.right + modalWidth + padding <= screenWidth) {
      left = Math.round(anchorRect.right + padding);
      right = undefined;
    } else if (anchorRect.left - modalWidth - padding >= 0) {
      left = Math.round(anchorRect.left - modalWidth - padding);
      right = undefined;
    }
    
    const isAnchorInBottomHalf = anchorRect.bottom > screenHeight * 0.55;
    let top: number | undefined;
    let bottom: number | undefined;
    
    if (isAnchorInBottomHalf) {
      bottom = Math.max(padding, Math.round(screenHeight - anchorRect.top + padding));
    } else {
      top = Math.max(padding, Math.round(anchorRect.bottom + padding));
    }
    
    if (top !== undefined && top > screenHeight - padding) top = padding;
    if (bottom !== undefined && bottom > screenHeight - padding) bottom = padding;
    
    let maxHeight = '80vh';
    if (top !== undefined) {
      maxHeight = `${screenHeight - top - padding * 2}px`;
    } else if (bottom !== undefined) {
      maxHeight = `${screenHeight - bottom - padding * 2}px`;
    }
    
    return {
      ...baseModalStyle,
      width: `${modalWidth}px`,
      left: left !== undefined ? `${left}px` : undefined,
      right: right !== undefined ? `${right}px` : undefined,
      top: top !== undefined ? `${top}px` : undefined,
      bottom: bottom !== undefined ? `${bottom}px` : undefined,
      maxHeight,
    };
  })();

  const modalHeaderStyle: React.CSSProperties = {
    padding: '16px 20px',
    background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const modalTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    background: 'linear-gradient(135deg, #a78bfa 0%, #60a5fa 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const originalBoxStyle: React.CSSProperties = {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '13px',
    color: '#94a3b8',
    maxHeight: '80px',
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    marginTop: '6px',
  };

  const refinedBoxStyle: React.CSSProperties = {
    backgroundColor: 'rgba(139, 92, 246, 0.03)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '8px',
    padding: '16px',
    fontSize: '14.5px',
    color: '#f8fafc',
    lineHeight: '1.5',
    maxHeight: '260px',
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    marginTop: '6px',
    boxShadow: 'inset 0 0 12px rgba(139, 92, 246, 0.05)',
  };

  const buttonRejectStyle: React.CSSProperties = {
    padding: '8px 16px',
    background: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '8px',
    color: '#94a3b8',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: '13.5px',
    transition: 'all 0.2s ease',
  };

  const buttonCopyStyle: React.CSSProperties = {
    padding: '8px 16px',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    color: '#e2e8f0',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: '13.5px',
    marginRight: '8px',
    transition: 'all 0.2s ease',
  };

  const buttonAcceptStyle: React.CSSProperties = {
    padding: '8px 20px',
    background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '13.5px',
    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.25)',
    transition: 'all 0.2s ease',
  };

  return (
    <>
      <style>{spinnerStyles}</style>

      {inlineBtnRect && inlineContainer && (
        <button
          data-refiner-button="true"
          type="button"
          style={{
            position: 'fixed',
            left: `${inlineBtnRect.left}px`,
            top: `${inlineBtnRect.top}px`,
            width: `${inlineBtnRect.width}px`,
            height: `${inlineBtnRect.height}px`,
            opacity: 0,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            zIndex: 2147483647,
            pointerEvents: 'auto',
            padding: 0,
            margin: 0,
            outline: 'none',
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!loading) {
              triggerRefine();
            }
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          title="Optimize with Prompt Enhancer ✨"
        />
      )}

      {!hasInline && (
        <button
          style={finalFloatingStyle}
          type="button"
          data-refiner-button="true"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            triggerRefine();
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          title="Optimize with Prompt Enhancer ✨"
          disabled={loading}
        >
          {loading ? (
            <span className="refiner-spinner">⏳</span>
          ) : (
            <span style={{ display: 'inline-block', transition: 'transform 0.2s ease', transform: isHovered ? 'scale(1.2)' : 'scale(1)' }}>✨</span>
          )}
        </button>
      )}

      {previewOpen && (
        <div style={anchoredModalStyle}>
          <div style={modalHeaderStyle}>
            <h3 style={modalTitleStyle}>
              <span style={{ fontSize: '18px' }}>✨</span> AI Prompt Enhancer
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => setSavedPromptsOpen(!savedPromptsOpen)}
                style={{
                  background: savedPromptsOpen ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.08)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '6px',
                  color: '#c084fc',
                  padding: '5px 10px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                  outline: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(139, 92, 246, 0.25)';
                  e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.45)';
                  e.currentTarget.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = savedPromptsOpen ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                  e.currentTarget.style.transform = 'none';
                }}
                title={savedPromptsOpen ? "Back to Enhancer" : "View Saved Prompts"}
              >
                <span>📂</span>
                <span>Saved ({data.savedPrompts?.length || 0})</span>
              </button>
              <button 
                onClick={handleReject} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0', transition: 'color 0.2s ease' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#f1f5f9'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
              >
                ×
              </button>
            </div>
          </div>
          
          {savedPromptsOpen ? (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', flex: '1 1 auto', overflowY: 'auto' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saved Prompts</span>
                <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
                  Click a saved prompt to instantly copy it to your clipboard.
                </span>
              </div>
              
              {!data.savedPrompts || data.savedPrompts.length === 0 ? (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  padding: '40px 20px', 
                  border: '1px dashed rgba(255, 255, 255, 0.1)', 
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.01)',
                  color: '#94a3b8',
                  textAlign: 'center',
                  gap: '12px',
                  marginTop: '10px'
                }}>
                  <span style={{ fontSize: '32px' }}>📂</span>
                  <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '14px' }}>No saved prompts yet</div>
                  <div style={{ fontSize: '12.5px', color: '#64748b', maxWidth: '280px' }}>
                    Optimize a prompt, then click the **Save** button in the footer to keep it for later.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
                  {data.savedPrompts.map((promptText, idx) => {
                    const isCopied = copiedIndex === idx;
                    return (
                      <div
                        key={idx}
                        onClick={() => handleCopySavedPrompt(promptText, idx)}
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          border: isCopied ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: '10px',
                          padding: '14px',
                          cursor: 'pointer',
                          position: 'relative',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '14px',
                          transition: 'all 0.2s ease',
                          boxShadow: isCopied ? '0 0 12px rgba(139, 92, 246, 0.15)' : 'none',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.04)';
                          e.currentTarget.style.borderColor = isCopied ? 'rgba(139, 92, 246, 0.5)' : 'rgba(139, 92, 246, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                          e.currentTarget.style.borderColor = isCopied ? 'rgba(139, 92, 246, 0.5)' : 'rgba(255, 255, 255, 0.06)';
                        }}
                      >
                        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                          <div style={{
                            fontSize: '13.5px',
                            color: '#f8fafc',
                            lineHeight: '1.45',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrientation: 'vertical',
                            overflow: 'hidden',
                            whiteSpace: 'pre-wrap',
                          } as any}>
                            {promptText}
                          </div>
                          {isCopied && (
                            <span style={{
                              fontSize: '11px',
                              color: '#c084fc',
                              fontWeight: 600,
                              marginTop: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              ✓ Copied to clipboard!
                            </span>
                          )}
                        </div>
                        
                        <button
                          onClick={(e) => handleDeletePrompt(idx, e)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            color: '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                            flexShrink: 0,
                            alignSelf: 'center',
                          }}
                          onMouseEnter={(e) => {
                            e.stopPropagation();
                            e.currentTarget.style.color = '#ef4444';
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.stopPropagation();
                            e.currentTarget.style.color = '#64748b';
                            e.currentTarget.style.background = 'none';
                          }}
                          title="Delete saved prompt"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', flex: '1 1 auto', overflowY: 'auto' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Original Prompt</span>
                <div style={originalBoxStyle}>{originalText}</div>
              </div>
              
              {previewError ? (
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Refinement Error</span>
                  <div style={{ ...refinedBoxStyle, borderColor: 'rgba(248, 113, 113, 0.35)', color: '#fecaca' }}>
                    {previewError}
                  </div>
                </div>
              ) : previewText ? (
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Optimized Prompt</span>
                  <div style={refinedBoxStyle}>{previewText}</div>
                </div>
              ) : (
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Refining...</span>
                  <div style={refinedBoxStyle}>
                    <span className="refiner-spinner">⏳</span> Optimizing your prompt...
                  </div>
                </div>
              )}
            </div>
          )}
          
          {savedPromptsOpen ? (
            <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(10, 11, 15, 0.4)' }}>
              <button 
                onClick={handleClearAllPrompts} 
                style={buttonRejectStyle}
                disabled={!data.savedPrompts || data.savedPrompts.length === 0}
                onMouseEnter={(e) => {
                  if (data.savedPrompts && data.savedPrompts.length > 0) {
                    e.currentTarget.style.color = '#ef4444';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#94a3b8';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                Clear All
              </button>
              <button 
                onClick={() => setSavedPromptsOpen(false)} 
                style={buttonAcceptStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.25)';
                }}
              >
                Back to Enhancer
              </button>
            </div>
          ) : (
            <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(10, 11, 15, 0.4)', alignItems: 'center' }}>
              <button 
                onClick={handleReject} 
                style={buttonRejectStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#f1f5f9';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#94a3b8';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                }}
              >
                Reject
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleSave}
                  disabled={!previewText || !!previewError || saveStatus === 'saving'}
                  style={{
                    padding: '8px 16px',
                    background: saveStatus === 'saved' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                    border: saveStatus === 'saved' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '8px',
                    color: saveStatus === 'saved' ? '#10b981' : '#c084fc',
                    cursor: (!previewText || !!previewError) ? 'not-allowed' : 'pointer',
                    fontWeight: 500,
                    fontSize: '13.5px',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    opacity: (!previewText || !!previewError) ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (previewText && !previewError) {
                      e.currentTarget.style.background = saveStatus === 'saved' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(139, 92, 246, 0.12)';
                      e.currentTarget.style.borderColor = saveStatus === 'saved' ? 'rgba(16, 185, 129, 0.5)' : 'rgba(139, 92, 246, 0.5)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (previewText && !previewError) {
                      e.currentTarget.style.background = saveStatus === 'saved' ? 'rgba(16, 185, 129, 0.1)' : 'transparent';
                      e.currentTarget.style.borderColor = saveStatus === 'saved' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(139, 92, 246, 0.3)';
                      e.currentTarget.style.transform = 'none';
                    }
                  }}
                >
                  {saveStatus === 'saving' ? (
                    <>
                      <span className="refiner-spinner">⏳</span> Saving...
                    </>
                  ) : saveStatus === 'saved' ? (
                    <>
                      <span>✓</span> Saved
                    </>
                  ) : (
                    <>
                      <span>💾</span> Save
                    </>
                  )}
                </button>
                <button 
                  onClick={handleCopy} 
                  style={buttonCopyStyle}
                  disabled={!previewText || !!previewError}
                  onMouseEnter={(e) => {
                    if (previewText && !previewError) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (previewText && !previewError) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.transform = 'none';
                    }
                  }}
                >
                  {copied ? 'Copied! ✓' : 'Copy'}
                </button>
                <button 
                  onClick={handleAccept} 
                  style={buttonAcceptStyle}
                  disabled={!previewText || !!previewError}
                  onMouseEnter={(e) => {
                    if (previewText && !previewError) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (previewText && !previewError) {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.25)';
                    }
                  }}
                >
                  Accept & Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function init() {
  if (document.getElementById('ai-prompt-refiner-root')) {
    return;
  }

  if (!document.body) {
    console.log("✨ Prompt Enhancer: document.body not ready yet, waiting...");
    return;
  }

  console.log("✨ Prompt Enhancer: Initializing and mounting root container...");
  try {
    const container = document.createElement('div');
    container.id = 'ai-prompt-refiner-root';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '0';
    container.style.height = '0';
    container.style.zIndex = '2147483647';
    container.style.pointerEvents = 'auto';
    container.style.overflow = 'visible';

    // Use shadow DOM to prevent styles from leaking
    const shadow = container.attachShadow({ mode: 'open' });
    const rootDiv = document.createElement('div');
    shadow.appendChild(rootDiv);

    document.body.appendChild(container);

    const root = ReactDOM.createRoot(rootDiv);
    root.render(<App />);
    console.log("✨ Prompt Enhancer: Root successfully injected into document.body.");
  } catch (e) {
    console.error("✨ Prompt Enhancer: Failed to mount React App:", e);
  }
}

// Ultra-robust self-healing scanner: check if root container exists every 1 second
// and re-initialize it if the site wipes it out during SPA rendering/navigation.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    setInterval(init, 1000);
  });
} else {
  init();
  setInterval(init, 1000);
}
