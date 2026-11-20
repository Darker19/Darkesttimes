// Scripts van de site (eerst stonden ze los in de HTML; als eigen bestand kan een strenge
// Content-Security-Policy losse scripts blokkeren). Elk stuk doet alleen iets als het element er is.
(() => {
const jaar = document.getElementById('year');
if (jaar) jaar.textContent = new Date().getFullYear();

// Mobiel menu: openen/sluiten, en sluiten na het kiezen van een link
const nav = document.querySelector(".nav");
const toggle = document.querySelector(".nav-toggle");
if (nav && toggle) {
const zetMenu = (open) => {
    nav.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", open);
    toggle.setAttribute("aria-label", open ? "Menu sluiten" : "Menu openen");
};
toggle.addEventListener("click", () => zetMenu(!nav.classList.contains("open")));
document.querySelectorAll(".nav-links a").forEach((a) => a.addEventListener("click", () => zetMenu(false)));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") zetMenu(false); });
}

// Contactformulier: versturen zonder de pagina te verlaten (zonder JavaScript werkt het formulier ook)
const form = document.querySelector(".contact-form");
if (form) {
const status = form.querySelector(".form-status");
const knop = form.querySelector("button[type=submit]");
form.addEventListener("submit", async (e) => {
    e.preventDefault();
    knop.disabled = true;
    status.className = "form-status";
    status.textContent = "Bezig met versturen…";
    try {
        const res = await fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } });
        const data = await res.json();
        status.textContent = data.bericht;
        status.classList.add(data.ok ? "ok" : "fout");
        if (data.ok) form.reset();
    } catch {
        status.textContent = "Versturen lukte even niet. Mail anders naar info@darkesttimes.nl.";
        status.classList.add("fout");
    }
    knop.disabled = false;
});
}
})();

// Magnetische gloed: één paarse gloed volgt de muis over de hele pagina.
// In de buurt van kaarten, knoppen en velden wordt hij naar het element toe getrokken,
// en eroverheen past hij zich aan het element aan en "plakt" hij er een beetje aan.
// Alleen met een muis; op telefoons en bij "minder beweging" staat hij uit.
(() => {
    const glow = document.querySelector(".cursor-glow");
    const metMuis = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const rustig = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!glow || !metMuis || rustig) return;

    const magneten = [...document.querySelectorAll(".card, .gradient-btn, .btn, .nav-brand, .footer-links a, input, textarea")];
    const BEREIK = 110;     // vanaf deze afstand (px) begint een element te trekken
    const TREK = 0.35;      // hoe sterk de gloed vlak naast een element naar het midden gaat
    const VOLG_BINNEN = 0.25; // op een element volgt de gloed de muis nog maar een beetje
    const RUST = 280;       // grootte van de gloed als hij vrij zweeft
    const MAX = 560;        // grootste formaat op een groot element
    const SNELHEID = 0.16;  // 0–1: hoe snel de gloed bijtrekt (lager = meer naloop)

    const muis = { x: innerWidth / 2, y: innerHeight / 2 };
    const nu = { x: muis.x, y: muis.y, w: RUST, h: RUST };
    let bezig = false;

    function doel() {
        let beste = null, besteAfstand = Infinity;
        for (const el of magneten) {
            const r = el.getBoundingClientRect();
            // afstand van de muis tot de rand van het element (0 = erboven)
            const dx = Math.max(r.left - muis.x, 0, muis.x - r.right);
            const dy = Math.max(r.top - muis.y, 0, muis.y - r.bottom);
            const d = Math.hypot(dx, dy);
            if (d < besteAfstand) { besteAfstand = d; beste = r; }
        }
        if (!beste || besteAfstand > BEREIK) return { x: muis.x, y: muis.y, w: RUST, h: RUST, vast: false };

        const mx = beste.left + beste.width / 2, my = beste.top + beste.height / 2;
        if (besteAfstand === 0) {
            return {
                x: mx + (muis.x - mx) * VOLG_BINNEN,
                y: my + (muis.y - my) * VOLG_BINNEN,
                w: Math.min(beste.width + 70, MAX),
                h: Math.min(beste.height + 70, MAX),
                vast: true,
            };
        }
        const s = (1 - besteAfstand / BEREIK) ** 2 * TREK;
        return { x: muis.x + (mx - muis.x) * s, y: muis.y + (my - muis.y) * s, w: RUST, h: RUST, vast: false };
    }

    function stap() {
        const t = doel();
        for (const k of ["x", "y", "w", "h"]) nu[k] += (t[k] - nu[k]) * SNELHEID;
        glow.style.width = nu.w + "px";
        glow.style.height = nu.h + "px";
        glow.style.transform = `translate3d(${nu.x - nu.w / 2}px, ${nu.y - nu.h / 2}px, 0)`;
        glow.classList.toggle("vast", t.vast);

        const klaar = ["x", "y", "w", "h"].every((k) => Math.abs(t[k] - nu[k]) < 0.3);
        if (klaar) { bezig = false; return; }
        requestAnimationFrame(stap);
    }
    const start = () => { if (!bezig) { bezig = true; requestAnimationFrame(stap); } };

    addEventListener("mousemove", (e) => {
        muis.x = e.clientX; muis.y = e.clientY;
        glow.classList.add("zichtbaar");
        start();
    }, { passive: true });
    // bij scrollen verschuiven de elementen onder de muis
    addEventListener("scroll", start, { passive: true });
    document.documentElement.addEventListener("mouseleave", () => glow.classList.remove("zichtbaar"));
})();
