# KliekNet Component Library

Ready-to-compose markup for the website and marketing UI. All of it relies on
`brand-tokens.css` plus the component CSS in the shared `klieknet.css`. For a new
standalone page, either link `klieknet.css` or copy the blocks you need.

## Nav (shrinking lockup)

```html
<nav id="mainNav">
  <a href="/" class="nav-logo">
    <div class="logo-circle"><img src="logo-final-round-white.png" alt="KliekNet"></div>
    <div class="logo-wordmark">
      <span class="logo-name">KLIEKNET</span>
      <span class="logo-sub">AI-Driven Solutions</span>
    </div>
  </a>
  <ul class="nav-links">
    <li><a href="ai-integration.html">AI Integration</a></li>
    <li><a href="services.html">Services</a></li>
    <li><a href="voicequote.html">VoiceQuote</a></li>
    <li><a href="how-it-works.html">How it works</a></li>
    <li><a href="portfolio.html">Portfolio</a></li>
    <li><a href="about.html">About</a></li>
    <li><a href="contact.html">Reach out</a></li>
  </ul>
  <div class="nav-end">
    <button class="theme-toggle" id="themeToggle" aria-label="Toggle dark mode">
      <svg class="icon-moon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      <svg class="icon-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
    </button>
    <a href="{booking-url}" target="_blank" rel="noopener" class="nav-cta">Book a slot →</a>
    <button class="hamburger" id="hamburger" aria-label="Open menu"><span></span><span></span><span></span></button>
  </div>
</nav>
```

Booking URL used across the site is the Google Calendar appointment schedule link
(see any uploaded page's `nav-cta` href).

## Page hero (inner pages)

```html
<div class="page-hero">
  <span class="s-eye s-eye-green">AI Integration</span>
  <h1>Connect your entire<br>business with AI.</h1>
  <p>One-line, benefit-led promise that names the client's pain and the outcome.</p>
</div>
```

For the home hero use the light `.hero` with a video/overlay and `.hero-badge`
(blinking green dot), `.hero-btns`, and a `.hero-stats` row. For proposals use the
**dark** hero (see proposal-blueprint.md).

## Section rhythm

Every section opens the same way — eyebrow, heading, lead — then content:

```html
<div class="section-dark">
  <span class="s-eye s-eye-green">Business Integration</span>
  <h2 class="s-h2 s-h2-w">One hub. Everything connected.</h2>
  <p class="s-desc s-desc-w">Lead paragraph in muted grey, ~2 lines.</p>
  <!-- grid of cards -->
</div>
```

`.s-h2-w` / `.s-desc-w` are the white-on-dark variants.

## Service list row

```html
<div class="svc-list">
  <div class="svc-row">
    <span class="svc-num">01</span>
    <div class="svc-icon-wrap"><div class="svc-icon"><svg>…</svg></div></div>
    <div class="svc-body">
      <h3>Workflow automation</h3>
      <p>One-paragraph description.</p>
      <div class="svc-tags"><span class="stag stag-green">Most popular</span><span class="stag">Email</span></div>
    </div>
    <span class="svc-badge badge-new">New</span>
  </div>
</div>
```

## Process grid (4 steps) & integration cards

Use `.proc-grid` (4 equal bordered columns, icon tile + number + H3 + line) for
"How it works", and the connect-hub / `.conn-item` list for integrations. Both are
fully defined in `klieknet.css`; reuse the class names rather than restyling.

## Cards & chips

- `.port-card` — portfolio card (16/9 image, tag in green, H3, line; lifts on hover).
- `.testi-card` — testimonial (green stars, italic quote, black avatar w/ initials).
- Chips: `.stag` (neutral) / `.stag-green` (green-tint, `--green-dark` text);
  pills `.pill` / `.pill-green`; status badges `.badge-new` / `.badge-core`.

## Contact form (intentionally square)

Inputs are **radius 0** with 1.5px `#9CA3AF` borders, focus to `--black`. Submit is
a square black button. Use `.contact-form`, `.form-row`, `.form-group`,
`.phone-row` exactly as in `klieknet.css`. Includes a honeypot field for spam.

## Messaging buttons

`.btn-wa` (WhatsApp green `#25D366`), `.btn-tg` (Telegram blue `#229ED9`),
`.btn-schedule` (black). Stack with `.msg-btns` / `.msg-btns-auto` (equal width).

## Footer (dark, 3-column)

```html
<footer>
  <div class="footer-top">
    <div>
      <div class="footer-name">KLIEKNET</div>
      <div class="footer-tagline">AI-driven solutions for small businesses — South Africa, serving clients globally.</div>
      <div class="footer-contact">
        <a href="tel:0849000193">084 900 0193</a>
        <a href="mailto:gustav@klieknet.com">gustav@klieknet.com</a>
      </div>
    </div>
    <div class="footer-col"><h4>Services</h4><ul>…</ul></div>
    <div class="footer-col"><h4>Company</h4><ul>…</ul></div>
  </div>
  <div class="footer-bottom">
    <div class="footer-copy">© 2026 KliekNet. All rights reserved.</div>
    <div class="footer-copy">Stellenbosch, Western Cape, South Africa</div>
  </div>
</footer>
```

## Required scripts (nav scroll, theme toggle, mobile menu)

```html
<script>
(function(){var nav=document.getElementById('mainNav');function t(){nav.classList.toggle('scrolled',window.scrollY>40)}window.addEventListener('scroll',t,{passive:true});t();})();
(function(){var btn=document.getElementById('themeToggle');if(!btn)return;btn.addEventListener('click',function(){var dark=document.documentElement.classList.toggle('dark');localStorage.setItem('klieknet-theme',dark?'dark':'light');});})();
(function(){var ham=document.getElementById('hamburger');var mob=document.getElementById('mobileMenu');if(!ham||!mob)return;ham.addEventListener('click',function(){ham.classList.toggle('open');mob.classList.toggle('open');});document.addEventListener('click',function(e){if(!ham.contains(e.target)&&!mob.contains(e.target)){ham.classList.remove('open');mob.classList.remove('open');}});})();
function closeMobileMenu(){var ham=document.getElementById('hamburger');var mob=document.getElementById('mobileMenu');if(ham)ham.classList.remove('open');if(mob)mob.classList.remove('open');}
</script>
```

Always pair these with the blocking dark-mode `<head>` script from SKILL.md §5.
