import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

// Scope and revert each reveal, including React Strict Mode and live changes to
// reduced-motion preferences. Nothing is hidden before JavaScript initializes.
export function useReveal<T extends HTMLElement>(key = "", editorial = false) {
  const ref = useRef<T | null>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const media = gsap.matchMedia(root);
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const targets = editorial
        ? root.querySelectorAll("[data-reveal]")
        : Array.from(root.children).filter(
            (node) =>
              !node.classList.contains("modal-backdrop") &&
              !(
                key &&
                node.matches(".back-link, .page-head, .case-stats, .case-tabs")
              ),
          );
      gsap.from(targets, {
        opacity: 0,
        y: editorial ? 28 : 14,
        duration: editorial ? 0.95 : 0.5,
        stagger: editorial ? 0.075 : 0.035,
        ease: "power4.out",
        clearProps: "opacity,transform",
      });
    });
    return () => media.revert();
  }, [key, editorial]);
  return ref;
}
