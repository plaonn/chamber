#!/usr/bin/env python3
import math
from pathlib import Path
import generate_brand_assets as b

SPEC, g, pal = b.SPEC, b.g, b.pal
wm = SPEC["wordmark"]
OUT = b.OUT
PREVIEWS = b.PREVIEWS
H = wm["metrics"]["height"]
BASELINE = wm["metrics"]["baseline"]
TOP = BASELINE - wm["metrics"]["x_height"]
ASC_TOP = wm["metrics"]["ascender_top"]
W = wm["metrics"]["module_width_W"]
T = wm["metrics"]["orthogonal_inset_T"]
OCH = wm["metrics"]["outer_chamfer_45"]
ICH = wm["metrics"]["inner_chamfer_45"]
D = wm["metrics"]["diagonal_line_delta"]
A_W = wm["widths"]["a"]
M_W = wm["widths"]["m"]
R_W = wm["widths"]["r"]
S = H / g["canvas"]["height"]
outer = [(x*S, y*S) for x,y in b.outer]
inner = [(x*S, y*S) for x,y in b.inner]
tri = [(x*S, y*S) for x,y in b.tri]
outer_path = b.rounded_polygon_path(outer, g["outer_octagon"]["corner_radius"]*S)
inner_path = b.rounded_polygon_path(inner, g["inner_octagon"]["corner_radius"]*S)
tri_str = " ".join(f"{x:.2f},{y:.2f}" for x,y in tri)

def fmt(v):
    return str(int(round(v))) if abs(v-round(v)) < 1e-9 else f"{v:.2f}"

def rounded_points(points, radius, steps=24):
    n=len(points); starts=[]; ends=[]
    for i,(x,y) in enumerate(points):
        px,py=points[(i-1)%n]; nx,ny=points[(i+1)%n]
        ax,ay=px-x,py-y; al=math.hypot(ax,ay); ax,ay=ax/al,ay/al
        bx,by=nx-x,ny-y; bl=math.hypot(bx,by); bx,by=bx/bl,by/bl
        r=min(radius,al/3,bl/3)
        starts.append((x+ax*r,y+ay*r)); ends.append((x+bx*r,y+by*r))
    out=[]
    for i,(x,y) in enumerate(points):
        sx,sy=starts[i]; ex,ey=ends[i]
        if not out: out.append((sx,sy))
        for k in range(1,steps+1):
            t=k/steps
            out.append(((1-t)**2*sx+2*(1-t)*t*x+t*t*ex,
                        (1-t)**2*sy+2*(1-t)*t*y+t*t*ey))
        ns=starts[(i+1)%n]
        if math.hypot(out[-1][0]-ns[0],out[-1][1]-ns[1])>1e-9: out.append(ns)
    if len(out)>1 and math.hypot(out[0][0]-out[-1][0],out[0][1]-out[-1][1])<1e-9: out.pop()
    return out

def intersect(a,bp,c,d):
    ax,ay=a; bx,by=bp; cx,cy=c; dx,dy=d
    rx,ry=bx-ax,by-ay; sx,sy=dx-cx,dy-cy; den=rx*sy-ry*sx
    if abs(den)<1e-12: return None
    qx,qy=cx-ax,cy-ay; t=(qx*sy-qy*sx)/den; u=(qx*ry-qy*rx)/den
    return ((ax+t*rx,ay+t*ry),t) if -1e-9<=t<=1+1e-9 and -1e-9<=u<=1+1e-9 else None

def hit(boundary,a,bp):
    hits=[]
    for i in range(len(boundary)):
        r=intersect(boundary[i],boundary[(i+1)%len(boundary)],a,bp)
        if r: hits.append((i,r[1],r[0]))
    if len(hits)!=1: raise RuntimeError(f"expected one wedge/boundary hit, got {len(hits)}")
    return hits[0]

def traverse(boundary,start,end,direction):
    n=len(boundary); si,_,sp=start; ei,_,ep=end; pts=[sp]
    if direction==1:
        i=(si+1)%n; stop=(ei+1)%n
        while i!=stop: pts.append(boundary[i]); i=(i+1)%n
    else:
        i=si
        while i!=ei: pts.append(boundary[i]); i=(i-1)%n
    pts.append(ep); return pts

def capital_c():
    ob=rounded_points(outer,g["outer_octagon"]["corner_radius"]*S)
    ib=rounded_points(inner,g["inner_octagon"]["corner_radius"]*S)
    apex,up,lo=tri
    ou,ol,iu,il=hit(ob,apex,up),hit(ob,apex,lo),hit(ib,apex,up),hit(ib,apex,lo)
    pts=traverse(ob,ou,ol,-1); pts.append(il[2]); pts.extend(traverse(ib,il,iu,1)[1:])
    return pts

C = capital_c()
C_PATH = "M " + " L ".join(f"{x:.3f},{y:.3f}" for x,y in C) + " Z"
C_RIGHT=max(x for x,_ in C)
assert abs(C_RIGHT-wm["capital_c"]["visual_right"])<0.05
positions={}; cursor=C_RIGHT+wm["tracking"]["capital_c_to_h"]
for ch in "hamber":
    positions[ch]=cursor; cursor+=wm["widths"][ch]
    if ch!="r": cursor+=wm["tracking"]["lowercase_pairs"]
WORD_W=positions["r"]+R_W

def rect(x,y,w,h): return f'<rect x="{fmt(x)}" y="{fmt(y)}" width="{fmt(w)}" height="{fmt(h)}"/>'
def poly(points): return '<polygon points="'+' '.join(f'{fmt(x)},{fmt(y)}' for x,y in points)+'"/>'
def sub(points): return 'M '+' L '.join(f'{fmt(x)},{fmt(y)}' for x,y in points)+' Z'

def lowercase():
    z=[]; x=positions["h"]
    z += [rect(x,ASC_TOP,T,BASELINE-ASC_TOP),rect(x,TOP,W,T),rect(x+W-T,TOP,T,BASELINE-TOP)]
    x=positions["a"]; left=T; right=A_W-T; top=TOP+T; bottom=BASELINE-T
    oa=[(0,TOP+OCH),(OCH,TOP),(A_W,TOP),(A_W,BASELINE),(0,BASELINE)]
    ca=[(left,top+ICH),(left+ICH,top),(right,top),(right,bottom-ICH),(right-ICH,bottom),(left,bottom)]
    c=right+bottom-ICH+D; nl=c-BASELINE; nr=A_W; half=(nr-nl)/2
    na=[(nl,BASELINE),((nl+nr)/2,BASELINE-half),(nr,BASELINE)]
    z.append(f'<path d="{sub([(x+a,y) for a,y in oa])} {sub([(x+a,y) for a,y in ca])} {sub([(x+a,y) for a,y in na])}" fill-rule="evenodd"/>')
    x=positions["m"]; mid=W-T
    z += [rect(x,TOP,T,BASELINE-TOP),rect(x+mid,TOP,T,BASELINE-TOP),rect(x+M_W-T,TOP,T,BASELINE-TOP),rect(x,TOP,W,T),rect(x+mid,TOP,W,T)]
    x=positions["b"]
    z += [rect(x,ASC_TOP,T,BASELINE-ASC_TOP),rect(x,TOP,W,T),rect(x+W-T,TOP,T,BASELINE-TOP),rect(x,BASELINE-T,W,T)]
    x=positions["e"]; mt=TOP+(wm["metrics"]["x_height"]-T)/2
    z += [rect(x,TOP,T,BASELINE-TOP),rect(x,TOP,W,T),rect(x+W-T,TOP,T,mt+T-TOP),rect(x,mt,W,T),rect(x,BASELINE-T,W,T)]
    x=positions["r"]; rh=wm["r"]["horizontal_component"]; rv=wm["r"]["vertical_component"]
    assert abs(rh-rv)<1e-9 and abs(rh+rv-D)<1e-9
    ux=R_W-rh; cu=ux+TOP; cl=cu+D; us=cu-T; ls=cl-T
    assert abs(us-wm["r"]["upper_split_y"])<1e-9
    z.append(poly([(x,TOP),(x+T,TOP),(x+T,us),(x+ux,TOP),(x+R_W,TOP),(x+R_W,TOP+rv),(x+T,ls),(x+T,BASELINE),(x,BASELINE)]))
    return ''.join(z)
LOWER=lowercase()

def gradients(prefix):
    z=[]; profile=SPEC["wordmark_aurora"]["radial_stop_profile"]
    for i,h in enumerate(SPEC["wordmark_aurora"]["hotspots"]):
        cx=h["cx_ratio"]*WORD_W; cy=h["cy_ratio"]*H; r=h["r_width_ratio"]*WORD_W; peak=h["peak_opacity"]; color=pal[h["color"]]
        z.append(f'<radialGradient id="{prefix}g{i}" gradientUnits="userSpaceOnUse" cx="{cx:.2f}" cy="{cy:.2f}" r="{r:.2f}"><stop offset="0%" stop-color="{color}" stop-opacity="{peak}"/><stop offset="62%" stop-color="{color}" stop-opacity="{peak*profile[1]["opacity_multiplier"]:.3f}"/><stop offset="100%" stop-color="{color}" stop-opacity="0"/></radialGradient>')
    return ''.join(z)

def word_inner(prefix,fill=None):
    geom=f'<path d="{C_PATH}"/>{LOWER}'; gid=prefix+'Geom'
    defs=(gradients(prefix) if fill is None else '')+f'<g id="{gid}">{geom}</g>'
    if fill is not None: return f'<defs>{defs}</defs><use href="#{gid}" fill="{fill}"/>'
    return f'<defs>{defs}</defs><use href="#{gid}" fill="{pal["wordmark_base"]}"/>'+''.join(f'<use href="#{gid}" fill="url(#{prefix}g{i})"/>' for i in range(len(SPEC["wordmark_aurora"]["hotspots"])))

def word_svg(fill=None):
    title='Chamber wordmark' if fill is None else 'Chamber monochrome wordmark'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-18 -18 {WORD_W+36:.2f} {H+36:.2f}" role="img" aria-labelledby="title desc"><title id="title">{title}</title><desc id="desc">Custom Chamber wordmark constructed from the canonical chamber geometry; no font dependency.</desc>{word_inner("wm" if fill is None else "wmm",fill)}</svg>\n'

def symbol_defs(prefix):
    ff=SPEC["aurora"]["frame_field"]; wf=SPEC["aurora"]["wedge_field"]; z=[]
    for fam,field in (("f",ff),("w",wf)):
        for i,h in enumerate(field):
            color=pal[h["color"]]; peak=h["peak_opacity"]
            z.append(f'<radialGradient id="{prefix}{fam}{i}" gradientUnits="userSpaceOnUse" cx="{h["cx"]*S:.2f}" cy="{h["cy"]*S:.2f}" r="{h["r"]*S:.2f}"><stop offset="0%" stop-color="{color}" stop-opacity="{peak}"/><stop offset="56%" stop-color="{color}" stop-opacity="{peak*.42:.3f}"/><stop offset="100%" stop-color="{color}" stop-opacity="0"/></radialGradient>')
    clip=prefix+'Clip'; ring=prefix+'Ring'; wedge=prefix+'Wedge'
    z.append(f'<clipPath id="{clip}"><path d="{outer_path}"/></clipPath><path id="{ring}" d="{outer_path} {inner_path}" fill-rule="evenodd"/><polygon id="{wedge}" points="{tri_str}" clip-path="url(#{clip})"/>')
    return ''.join(z),ring,wedge

def symbol_color(prefix):
    defs,ring,wedge=symbol_defs(prefix); ff=SPEC["aurora"]["frame_field"]; wf=SPEC["aurora"]["wedge_field"]
    return f'<defs>{defs}</defs><use href="#{ring}" fill="{pal["frame_base"]}"/>'+''.join(f'<use href="#{ring}" fill="url(#{prefix}f{i})"/>' for i in range(len(ff)))+f'<use href="#{wedge}" fill="{pal["wedge_base"]}"/>'+''.join(f'<use href="#{wedge}" fill="url(#{prefix}w{i})"/>' for i in range(len(wf)))

def symbol_mono(fill,prefix):
    clip=prefix+'Clip'
    return f'<defs><clipPath id="{clip}"><path d="{outer_path}"/></clipPath></defs><path d="{outer_path} {inner_path}" fill="{fill}" fill-rule="evenodd"/><polygon points="{tri_str}" fill="{fill}" opacity="0.72" clip-path="url(#{clip})"/>'

GAP=wm["lockup"]["symbol_to_wordmark_gap"]; WORD_X=H+GAP; LOCK_W=WORD_X+WORD_W

def lock_inner(fill=None,prefix='lock'):
    symbol=symbol_color(prefix+'Sym') if fill is None else symbol_mono(fill,prefix+'SymM')
    word=word_inner(prefix+'Wm' if fill is None else prefix+'WmM',fill)
    return f'{symbol}<svg x="{fmt(WORD_X)}" y="0" width="{WORD_W:.2f}" height="{H:.2f}" viewBox="0 0 {WORD_W:.2f} {H:.2f}">{word}</svg>'

def lock_svg(fill=None):
    title='Chamber horizontal lockup' if fill is None else 'Chamber monochrome horizontal lockup'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-18 -18 {LOCK_W+36:.2f} {H+36:.2f}" role="img" aria-labelledby="title desc"><title id="title">{title}</title><desc id="desc">Canonical Chamber symbol paired with the custom Chamber wordmark at equal cap height.</desc>{lock_inner(fill)}</svg>\n'

def preview(background):
    # Non-canonical presentation wrapper around the canonical lockup asset.
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 480">'
        f'<rect width="1280" height="480" rx="32" fill="{background}"/>'
        '<image href="../chamber-lockup-horizontal.svg" x="80" y="153" width="1120" height="174" preserveAspectRatio="xMidYMid meet"/>'
        '</svg>\n'
    )

(OUT/'chamber-wordmark.svg').write_text(word_svg(),encoding='utf-8')
(OUT/'chamber-wordmark-monochrome-dark.svg').write_text(word_svg(pal['monochrome_dark']),encoding='utf-8')
(OUT/'chamber-wordmark-monochrome-light.svg').write_text(word_svg(pal['monochrome_light']),encoding='utf-8')
(OUT/'chamber-lockup-horizontal.svg').write_text(lock_svg(),encoding='utf-8')
(OUT/'chamber-lockup-horizontal-monochrome-dark.svg').write_text(lock_svg(pal['monochrome_dark']),encoding='utf-8')
(OUT/'chamber-lockup-horizontal-monochrome-light.svg').write_text(lock_svg(pal['monochrome_light']),encoding='utf-8')
(PREVIEWS/'chamber-on-light.svg').write_text(preview('#FFFFFF'),encoding='utf-8')
(PREVIEWS/'chamber-on-dark.svg').write_text(preview(pal['dark_background']),encoding='utf-8')
print('Generated Chamber wordmark and lockup assets.')
