"""Builds the Sinapi Elementor brand kit + Concept B 'LEVO product' page as Elementor JSON.
Settings names verified against Elementor 4.x source (includes/elements/container.php, widgets/*, nested-tabs)."""
import json, random

random.seed(7)
def uid(): return '%07x' % random.getrandbits(28)

BASE = "https://klieknet-testing.co.za/sinapi/wp-content/uploads/2026/10/"
MEDIA = {
  "logo": (9, BASE + "sinapi-biomedical-logo.png"),
  "logo_w": (10, BASE + "sinapi-biomedical-logo-white.png"),
  "levo": (11, BASE + "sinapi-levo-render.jpg"),
  "icu": (12, BASE + "levo-setup-icu.jpg"),
  "unit": (13, BASE + "levo-unit-explained.jpg"),
  "walk": (14, BASE + "levo-early-mobilisation.jpg"),
}
VID_MAIN = "https://www.youtube.com/watch?v=S_iZ_Bl5E7Q"
VID_ERAS = "https://www.youtube.com/watch?v=p8rVQNogAxg"

# ---------- brand kit (Site Settings) ----------
C = {"primary": "#264B81", "secondary": "#4891CE", "text": "#5B6880", "accent": "#18263D",
     "sky": "#EEF4FB", "line": "#E1E7EF", "bg": "#F7F9FC", "white": "#FFFFFF"}
G = lambda k: f"globals/colors?id={k}"
T = lambda k: f"globals/typography?id={k}"

GROW = {"_flex_size": "custom", "_flex_grow": 1, "_flex_shrink": 1}
def px(v): return {"unit": "px", "size": v, "sizes": []}
def dims(t, r=None, b=None, l=None, unit="px"):
    r = t if r is None else r; b = t if b is None else b; l = r if l is None else l
    return {"unit": unit, "top": str(t), "right": str(r), "bottom": str(b), "left": str(l), "isLinked": t == r == b == l}
def gap(v): return {"unit": "px", "size": v, "column": str(v), "row": str(v), "isLinked": True}

def typo(fam, weight, size, lh=None, ls=None, transform=None):
    t = {"typography_typography": "custom", "typography_font_family": fam, "typography_font_weight": str(weight),
         "typography_font_size": px(size)}
    if lh: t["typography_line_height"] = {"unit": "em", "size": lh, "sizes": []}
    if ls is not None: t["typography_letter_spacing"] = {"unit": "px", "size": ls, "sizes": []}
    if transform: t["typography_text_transform"] = transform
    return t

KIT = {
  "system_colors": [
    {"_id": "primary", "title": "Sinapi navy", "color": C["primary"]},
    {"_id": "secondary", "title": "Sinapi blue", "color": C["secondary"]},
    {"_id": "text", "title": "Body text", "color": C["text"]},
    {"_id": "accent", "title": "Ink", "color": C["accent"]},
  ],
  "custom_colors": [
    {"_id": "sky", "title": "Sky tint", "color": C["sky"]},
    {"_id": "line", "title": "Hairline", "color": C["line"]},
    {"_id": "bg", "title": "Soft background", "color": C["bg"]},
    {"_id": "white", "title": "White", "color": C["white"]},
  ],
  "system_typography": [
    {"_id": "primary", "title": "Headings", **typo("Poppins", 700, 32, 1.15, -0.4)},
    {"_id": "secondary", "title": "Subheadings", **typo("Poppins", 600, 18, 1.3)},
    {"_id": "text", "title": "Body", **typo("Montserrat", 400, 15, 1.6)},
    {"_id": "accent", "title": "Labels", **typo("Montserrat", 700, 11, 1.4, 1.4, "uppercase")},
  ],
  "custom_typography": [
    {"_id": "small", "title": "Small text", **typo("Montserrat", 500, 12, 1.5)},
  ],
  "container_width": px(1240),
  "space_between_widgets": {"unit": "px", "size": 0, "column": "0", "row": "0", "isLinked": True},
  "body_background_background": "classic", "body_background_color": C["white"],
  "body_color": C["text"],
  "body_typography_typography": "custom", "body_typography_font_family": "Montserrat",
  "body_typography_font_size": px(15), "body_typography_font_weight": "400",
  "link_normal_color": C["primary"],
  "button_typography_typography": "custom", "button_typography_font_family": "Montserrat",
  "button_typography_font_weight": "600", "button_typography_font_size": px(13),
  "button_text_color": C["white"], "button_background_background": "classic", "button_background_color": C["primary"],
  "button_hover_background_background": "classic", "button_hover_background_color": C["accent"],
  "button_typography_text_transform": "none", "button_typography_letter_spacing": {"unit": "px", "size": 0, "sizes": []},
  "button_border_radius": dims(8), "button_padding": dims(11, 20),
  "viewport_md": 768, "viewport_lg": 1025,
}

# ---------- element helpers ----------
def container(children, title=None, inner=True, **s):
    st = {"content_width": "full", "flex_direction": "column", "padding": dims(0)}
    st.update(s)
    if title: st["_title"] = title
    if "width" in st:
        st.setdefault("width_tablet", st["width"])
        st.setdefault("width_mobile", st["width_tablet"])
    if "row" in (st.get("flex_direction"), st.get("flex_direction_tablet"), st.get("flex_direction_mobile")) and "flex_wrap" not in st:
        st.update({"flex_wrap": "nowrap", "flex_wrap_tablet": "nowrap", "flex_wrap_mobile": "nowrap"})
    return {"id": uid(), "elType": "container", "isInner": inner, "settings": st, "elements": children}

def boxed(children, title=None, **s):
    st = {"content_width": "boxed", "boxed_width": px(1240), "flex_direction": "column"}
    st.update(s)
    return container(children, title, inner=False, **st)

def widget(wtype, **s):
    return {"id": uid(), "elType": "widget", "widgetType": wtype, "isInner": False, "settings": s, "elements": []}

def heading(text, tag="h2", size=None, color="accent", g_typo="primary", align=None, **extra):
    s = {"title": text, "header_size": tag, "__globals__": {"title_color": G(color)}}
    if g_typo and not size: s["__globals__"]["typography_typography"] = T(g_typo)
    if size:
        fam, wt = {"primary": ("Poppins", "700"), "secondary": ("Poppins", "600")}.get(g_typo or "", ("Montserrat", "600"))
        s.update({"typography_font_family": fam, "typography_font_weight": wt, "typography_line_height": {"unit": "em", "size": 1.25, "sizes": []}})
        s.update({"typography_typography": "custom", "typography_font_size": px(size[0]),
                  "typography_font_size_tablet": px(size[1]), "typography_font_size_mobile": px(size[2])})
    if align: s["align"] = align
    s.update(extra)
    return widget("heading", **s)

def label(text, color="secondary"):
    return widget("heading", title=text, header_size="div", __globals__={"title_color": G(color), "typography_typography": T("accent")})

def text(html_, color="text", g="text", **extra):
    s = {"editor": html_, "__globals__": {"text_color": G(color)}}
    if g: s["__globals__"]["typography_typography"] = T(g)
    s.update(extra)
    return widget("text-editor", **s)

def image(key, width=None, **extra):
    i, u = MEDIA[key]
    s = {"image": {"id": i, "url": u, "alt": "", "source": "library"}, "image_size": "full", "align": "left"}
    if width: s.update({"width": px(width[0]), "width_tablet": px(width[1]), "width_mobile": px(width[2])})
    s.update(extra)
    return widget("image", **s)

def button(txt, url="#", outline=False, small=False, **extra):
    s = {"text": txt, "link": {"url": url, "is_external": "", "nofollow": ""},
         "typography_typography": "custom", "typography_font_family": "Montserrat", "typography_font_weight": "600",
         "typography_font_size": px(13), "typography_text_transform": "none", "typography_letter_spacing": px(0),
         "border_radius": dims(8)}
    if outline:
        s.update({"background_background": "classic", "background_color": "rgba(0,0,0,0)",
                  "border_border": "solid", "border_width": dims(1.5), "__globals__": {"button_text_color": G("primary"), "border_color": G("primary")}})
    if small:
        s.update({"text_padding": dims(7, 14), "typography_typography": "custom", "typography_font_size": px(12)})
    g = {"typography_typography": ""}
    g.update(s.get("__globals__", {})); g.update(extra.pop("__globals__", {}))
    s.update(extra); s["__globals__"] = g
    return widget("button", **s)

def icon(fa, color="primary", size=16, **extra):
    s = {"selected_icon": {"value": fa, "library": "fa-solid"}, "size": px(size), "__globals__": {"primary_color": G(color)}}
    s.update(extra)
    return widget("icon", **s)

def video(url, overlay_key, ratio="169"):
    i, u = MEDIA[overlay_key]
    return widget("video", video_type="youtube", youtube_url=url, yt_privacy="yes", lazy_load="yes", rel="",
                  show_image_overlay="yes", image_overlay={"id": i, "url": u, "source": "library"},
                  show_play_icon="yes", aspect_ratio=ratio, play_icon_size=px(56),
                  _border_radius=dims(12))

def doc_row(title, meta, kind="PDF"):
    ic = container([text(f"<strong>{kind}</strong>", color="primary", g="accent", align="center")],
                   "File type", width=px(38), _flex_size="none", min_height=px(44),
                   flex_justify_content="center", background_background="classic", border_radius=dims(6),
                   __globals__={"background_color": G("sky")})
    body = container([heading(title, "h4", (14, 14, 13), "accent", "secondary"),
                      text(f"<p>{meta}</p>", g="small")], "Document", flex_gap=gap(2), **GROW)
    dl = icon("fas fa-arrow-down", "primary", 13, view="framed", shape="circle", icon_padding=px(8), border_width=dims(1),
              link={"url": "#", "is_external": "", "nofollow": ""})
    dl["settings"]["__globals__"]["secondary_color"] = G("white")
    return container([ic, body, dl], f"Download · {title}", flex_direction="row", flex_align_items="center",
                     flex_gap=gap(12), padding=dims(12, 14), border_border="solid", border_width=dims(1),
                     border_radius=dims(10), background_background="classic",
                     __globals__={"border_color": G("line"), "background_color": G("white")})

def next_item(title, sub, key, dur):
    th = container([image(key, (96, 96, 84), image_border_radius=dims(8))], "Thumbnail", width=px(96), width_mobile=px(84), _flex_size="none")
    t = container([heading(title, "h5", (13, 13, 12), "accent", "secondary"),
                   text(f"<p>{sub} · {dur}</p>", g="small")], "Title", flex_gap=gap(2), **GROW)
    return container([th, t], f"Up next · {title}", flex_direction="row", flex_align_items="center", flex_gap=gap(12))

# ---------- tab content ----------
def tab_panel(title, intro, vid, overlay, docs, chapters=None, upnext=None):
    left_children = [video(vid, overlay), heading(title, "h3", (22, 20, 18), "accent", "primary"), text(f"<p>{intro}</p>")]
    if chapters:
        chips = [button(c, "#", outline=(i != 1), small=True,
                        **({"__globals__": {"background_color": G("sky"), "button_text_color": G("primary"), "border_color": G("secondary")}} if i == 1 else {}))
                 for i, c in enumerate(chapters)]
        left_children.append(container(chips, "Chapters", flex_direction="row", flex_wrap="wrap", flex_gap=gap(8)))
    left = container(left_children, "Video", flex_gap=gap(12), width=px(58) | {"unit": "%"}, width_tablet={"unit": "%", "size": 100, "sizes": []}, _flex_size="none")
    right_children = [label("Downloads for this level", "text")] + [doc_row(*d) for d in docs]
    if upnext:
        right_children.append(label("Up next", "text") | {})
        right_children[-1]["settings"]["_margin"] = dims(10, 0, 0, 0)
        right_children += [next_item(*u) for u in upnext]
    right = container(right_children, "Downloads", flex_gap=gap(10), **GROW)
    return container([left, right], title, flex_direction="row", flex_direction_tablet="column", flex_gap=gap(28), padding=dims(24, 0, 0, 0))

TABS = [
  ("30 sec", "LEVO in 30 seconds", "The three reasons hospitals switch to LEVO: early patient mobilisation, fewer user errors and earlier chest tube removal.", VID_MAIN, "walk",
   [("LEVO flyer", "A4 · 1 page")], None, None),
  ("5 min", "LEVO in 5 minutes", "A short overview for sales reps and new staff: what LEVO is, who it is for and how it differs from a traditional chest drain.", VID_MAIN, "unit",
   [("Rep training document", "PDF · 6 pages")], None, None),
  ("Set-up", "Setting up LEVO", "Follow along at the bedside. Chapters let staff jump straight to the step they need, in ICU, theatre or ER.", VID_MAIN, "icu",
   [("ICU set-up poster", "A3 · updated Sep 2026"), ("OT & ER set-up poster", "A3 · updated Sep 2026"), ("Instructions for use", "PDF · 12 pages")],
   ["1 · Unbox", "2 · Connect", "3 · Fill water seal", "4 · Suction", "5 · Check"],
   [("Train the trainer: reading the LEVO unit", "Level 4", "unit", "8:05"), ("Cardiac: early mobilisation and ERAS", "Clinical", "walk", "4:30")]),
  ("Train the trainer", "Train the trainer", "Everything a clinical lead needs to train their own team on LEVO, with a ready-made presentation and assessment.", VID_MAIN, "unit",
   [("Trainer presentation", "PPTX · 18 slides"), ("Competency checklist", "PDF · 2 pages")], None, None),
  ("Clinical", "Clinical: cardiac, thoracic, trauma", "LEVO in practice for each specialty: ERAS pathways, the golden hour in trauma and post-operative drainage.", VID_ERAS, "walk",
   [("ERAS poster", "A3 · 1 page"), ("Golden hour guide", "PDF · 4 pages")], None, None),
  ("Resources", "Resources", "The health-economics case, cost-saving flyer and catalogue for procurement teams.", VID_MAIN, "unit",
   [("Health economics case", "PDF · 10 pages"), ("Cost-saving flyer", "A4 · 1 page"), ("Product catalogue", "PDF · 24 pages")], None, None),
]

def tabs_widget():
    tabs = [{"_id": uid(), "tab_title": t[0]} for t in TABS]
    panels = []
    for t in TABS:
        p = tab_panel(t[1], t[2], t[3], t[4], t[5], t[6], t[7])
        p["isLocked"] = True
        p["settings"]["_title"] = t[0]
        panels.append(p)
    s = {"tabs": tabs, "tabs_direction": "block-start", "tabs_justify_horizontal": "start",
         "horizontal_scroll": "enable", "breakpoint_selector": "none",
         "tabs_title_space_between": gap(4), "tabs_title_spacing": px(0),
         "padding": dims(9, 16), "tabs_title_border_radius": dims(8),
         "tabs_title_background_color_background": "classic",
         "tabs_title_background_color_hover_background": "classic",
         "tabs_title_background_color_active_background": "classic",
         "tabs_title_border_border": "none", "tabs_title_border_active_border": "none",
         "title_typography_typography": "custom", "title_typography_font_family": "Montserrat",
         "title_typography_font_weight": "600", "title_typography_font_size": px(13),
         "box_border_border": "none", "box_padding": dims(0), "box_background_color_background": "classic",
         "__globals__": {"tabs_title_background_color_color": G("bg"), "tabs_title_background_color_hover_color": G("sky"),
                         "tabs_title_background_color_active_color": G("primary"),
                         "title_text_color": G("text"), "title_text_color_hover": G("primary"), "title_text_color_active": G("white"),
                         "box_background_color_color": G("white")}}
    return {"id": uid(), "elType": "widget", "widgetType": "nested-tabs", "isInner": False, "settings": s, "elements": panels}

# ---------- page sections ----------
def header():
    nav = widget("nav-menu", menu="main-menu", layout="horizontal", align_items="center", pointer="underline",
                 animation_line="fade", dropdown="tablet", full_width="stretch", toggle="burger", toggle_align="right",
                 text_align="aside",
                 menu_typography_typography="custom", menu_typography_font_family="Montserrat",
                 menu_typography_font_weight="600", menu_typography_font_size=px(13),
                 padding_horizontal_menu_item=px(14), padding_vertical_menu_item=px(8),
                 dropdown_typography_typography="custom", dropdown_typography_font_family="Montserrat",
                 dropdown_typography_font_weight="600", dropdown_typography_font_size=px(15),
                 padding_horizontal_dropdown_item=px(24), padding_vertical_dropdown_item=px(14),
                 dropdown_top_distance=px(14), toggle_size=px(22), toggle_border_width=px(0), toggle_border_radius=px(8),
                 _flex_order_tablet="end", _flex_order_mobile="end",
                 _flex_size="custom", _flex_grow=1, _flex_shrink=1,
                 __globals__={"color_menu_item": G("text"), "color_menu_item_hover": G("primary"),
                              "pointer_color_menu_item_hover": G("secondary"), "color_menu_item_active": G("primary"),
                              "pointer_color_menu_item_active": G("secondary"),
                              "color_dropdown_item": G("accent"), "background_color_dropdown_item": G("white"),
                              "color_dropdown_item_hover": G("primary"), "background_color_dropdown_item_hover": G("sky"),
                              "color_dropdown_item_active": G("primary"), "background_color_dropdown_item_active": G("sky"),
                              "toggle_color": G("primary"), "toggle_background_color": G("sky")})
    right = container([button("EN ▾", outline=True, small=True), button("Request access", small=True, hide_mobile="hidden-mobile")],
                      "Actions", flex_direction="row", flex_align_items="center", flex_gap=gap(10), _flex_size="none", width={"unit": "custom", "size": "auto", "sizes": []})
    return boxed([image("logo", (120, 110, 96), _element_width="initial", _element_custom_width=px(120), _element_custom_width_mobile=px(96), _flex_size="none"), nav, right],
                 "Header (sticky)", flex_direction="row", flex_justify_content="space-between", flex_justify_content_tablet="space-between", flex_justify_content_mobile="space-between",
                 flex_align_items="center", flex_gap=gap(16), padding=dims(14, 24), padding_mobile=dims(10, 16),
                 border_border="solid", border_width=dims(0, 0, 1, 0), background_background="classic",
                 sticky="top", sticky_on=["desktop", "tablet", "mobile"], sticky_offset=0, sticky_effects_offset=10, z_index=99,
                 __globals__={"border_color": G("line"), "background_color": G("white")})

def product_aside():
    card = container([image("levo", (190, 80, 64), align="center")], "Product image", padding=dims(16), padding_mobile=dims(4),
                     flex_align_items="center", border_border="solid", border_width=dims(1), border_radius=dims(14),
                     background_background="classic", width_tablet=px(110), width_mobile=px(72), _flex_size_tablet="none", _flex_size_mobile="none",
                     __globals__={"border_color": G("line"), "background_color": G("white")})
    titles = container([
        text('<p>Products › <strong>Chest drainage</strong></p>', g="small", hide_mobile="hidden-mobile"),
        heading("Sinapi LEVO", "h1", (30, 28, 22), "primary", "primary"),
        text("<p>Chest drainage system for cardiac, thoracic and trauma patients.</p>", g="small"),
    ], "Product title", flex_gap=gap(6), **GROW)
    benefits = widget("icon-list", icon_list=[
        {"_id": uid(), "text": t, "selected_icon": {"value": "fas fa-check-circle", "library": "fa-solid"}}
        for t in ["Early patient mobilisation", "Reduced user error", "Earlier chest tube removal"]],
        space_between=px(8), icon_size=px(14), text_indent=px(6), hide_mobile="hidden-mobile", hide_tablet="hidden-tablet",
        icon_typography_typography="custom", icon_typography_font_family="Montserrat", icon_typography_font_weight="600", icon_typography_font_size=px(13),
        __globals__={"icon_color": G("secondary"), "text_color": G("accent")})
    return container([card, titles, benefits], "Product", flex_gap=gap(16), flex_direction_tablet="row", flex_align_items_tablet="center", flex_direction_mobile="row", flex_align_items_mobile="center",
                     width=px(300), width_tablet={"unit": "%", "size": 100, "sizes": []}, _flex_size="none",
                     padding=dims(28, 24), padding_mobile=dims(16), background_background="classic",
                     border_border="solid", border_width=dims(0, 1, 0, 0), border_width_tablet=dims(0, 0, 1, 0),
                     __globals__={"background_color": G("bg"), "border_color": G("line")})

def product_main():
    return container([label("How deep do you want to go?", "text"), tabs_widget()], "Training", flex_gap=gap(14),
                     padding=dims(28, 40, 40, 40), padding_tablet=dims(24), padding_mobile=dims(16), **GROW)

def body():
    return boxed([product_aside(), product_main()], "Product page", flex_direction="row", flex_direction_tablet="column",
                 flex_gap=gap(0), padding=dims(0))

def coming_soon():
    cards = []
    for cat, name in [("Urinary drainage", "Urine meters"), ("Obstetrics", "Maternal health"), ("Specimen collection", "Specimen range"), ("Nutrition", "Feeding products")]:
        cards.append(container([label(cat, "text"), heading(name, "h4", (16, 16, 15), "accent", "secondary"), text("<p>Training coming soon</p>", g="small")],
                               name, flex_gap=gap(4), padding=dims(18), border_border="solid", border_width=dims(1), border_radius=dims(12),
                               background_background="classic", width={"unit": "%", "size": 23, "sizes": []},
                               width_tablet={"unit": "%", "size": 48, "sizes": []}, width_mobile={"unit": "%", "size": 100, "sizes": []},
                               _flex_size="none", __globals__={"border_color": G("line"), "background_color": G("white")}))
    grid = container(cards, "Products", flex_direction="row", flex_wrap="wrap", flex_gap=gap(16))
    return boxed([label("More Sinapi devices", "secondary"), heading("Training for the full range", "h2", (26, 24, 22), "accent", "primary"), grid],
                 "Coming soon", flex_gap=gap(10), padding=dims(48, 24), padding_mobile=dims(32, 16),
                 background_background="classic", __globals__={"background_color": G("bg")})

def footer():
    return boxed([image("logo_w", (110, 110, 96), _element_width="initial", _element_custom_width=px(110), _flex_size="none"),
                  text("<p>© 2026 Sinapi Biomedical · Stellenbosch, South Africa</p>", color="white", g="small")],
                 "Footer", flex_direction="row", flex_direction_mobile="column", flex_justify_content="space-between",
                 flex_align_items="center", flex_gap=gap(12), padding=dims(28, 24), background_background="classic",
                 __globals__={"background_color": G("primary")})

PAGE = [header(), body(), coming_soon(), footer()]

if __name__ == "__main__":
    json.dump(KIT, open("./kit-settings.json", "w"), indent=1)
    json.dump(PAGE, open("./levo-page-data.json", "w"))
    tpl = {"content": PAGE, "page_settings": {"hide_title": "yes", "template": "elementor_canvas"},
           "version": "0.4", "title": "Sinapi – LEVO product page (Concept B)", "type": "page"}
    json.dump(tpl, open("./sinapi-levo-product-page.json", "w"), indent=1)
    n = sum(1 for _ in json.dumps(PAGE))
    print("ok", n)
