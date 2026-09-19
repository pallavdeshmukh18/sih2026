import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAccessibility } from '../../context/AccessibilityContext';
import { accessibleSignText } from './isl/siteText.js';

// Independent of voice preferences. Works for static and dynamically inserted content.
export default function ISLTextGuide() {
  const { islEnabled, requestSign, clearSign } = useAccessibility();
  const { pathname } = useLocation();
  useEffect(() => { clearSign(); }, [pathname, clearSign]);
  useEffect(() => {
    if (!islEnabled) return;
    let timer;
    let previous = '';
    const selector = 'button,a,input,textarea,select,label,h1,h2,h3,h4,h5,h6,p,li,dt,dd,td,th,span,[role="button"],[data-sign-text],[data-acc-text]';
    const trigger = event => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest('[data-isl-ignore], [data-testid="isl-avatar-card"]')) return;
      const element = target.closest('button,a,[role="button"]') || target.closest(selector);
      const text = accessibleSignText(element);
      clearTimeout(timer);
      if (!text || text === previous) return;
      const explicit = event.type === 'focusin' || event.type === 'click';
      timer = setTimeout(() => {
        previous = text;
        requestSign(text, { context: 'page_text', autoExpand: explicit });
      }, explicit ? 0 : 250);
    };
    const cancel = event => {
      if (event.target instanceof Element && event.target.contains(event.relatedTarget)) return;
      clearTimeout(timer);
      previous = '';
    };
    const selection = () => {
      const selected = window.getSelection();
      const parent = selected?.anchorNode?.parentElement;
      if (parent?.closest('[data-isl-ignore], input, textarea, [contenteditable="true"]')) return;
      const text = selected?.toString().trim();
      if (text) {
        clearTimeout(timer);
        requestSign(text, { context: 'selected_text', autoExpand: true });
      }
    };
    document.addEventListener('mouseover', trigger);
    document.addEventListener('focusin', trigger);
    document.addEventListener('click', trigger);
    document.addEventListener('mouseout', cancel);
    document.addEventListener('pointerup', selection);
    document.addEventListener('keyup', selection);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseover', trigger);
      document.removeEventListener('focusin', trigger);
      document.removeEventListener('click', trigger);
      document.removeEventListener('mouseout', cancel);
      document.removeEventListener('pointerup', selection);
      document.removeEventListener('keyup', selection);
    };
  }, [islEnabled, requestSign, pathname]);
  return null;
}
