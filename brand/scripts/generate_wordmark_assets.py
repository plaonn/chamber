#!/usr/bin/env python3
import math
import generate_brand_assets as b

SPEC,g,pal=b.SPEC,b.g,b.pal
wm=SPEC['wordmark']; sa=wm['symbol_as_c']; OUT=b.OUT; PREVIEWS=b.PREVIEWS
H=wm['metrics']['height']; BASE=wm['metrics']['baseline']; TOP=BASE-wm['metrics']['x_height']; ASC=wm['metrics']['ascender_top']
W=wm['metrics']['module_width_W']; T=wm['metrics']['orthogonal_inset_T']; OCH=wm['metrics']['outer_chamfer_45']; ICH=wm['metrics']['inner_chamfer_45']; D=wm['metrics']['diagonal_line_delta']
A_W=wm['widths']['a']; M_W=wm['widths']['m']; R_W=wm['widths']['r']; S=sa['scale']; Y0=sa['top']; SYM_W=sa['width']
outer=[(x*S,y*S+Y0) for x,y in b.outer]; inner=[(x*S,y*S+Y0) for x,y in b.inner]; tri=[(x*S,y*S+Y0) for x,y in b.tri]
outer_path=b.rounded_polygon_path(outer,g['outer_octagon']['corner_radius']*S); tri_str=' '.join(f'{x:.3f},{y:.3f}' for x,y in tri)

def f(v):
    s=f'{v:.3f}'.rstrip('0').rstrip('.'); return s if s!='-0' else '0'
def sub(ps): return 'M '+' L '.join(f'{f(x)},{f(y)}' for x,y in ps)+' Z'
def rounded(ps,r,steps=8):
    n=len(ps); starts=[]; ends=[]
    for i,(x,y) in enumerate(ps):
        px,py=ps[i-1]; nx,ny=ps[(i+1)%n]
        ax,ay=px-x,py-y; al=math.hypot(ax,ay); bx,by=nx-x,ny-y; bl=math.hypot(bx,by)
        rr=min(r,al/3,bl/3); starts.append((x+ax/al*rr,y+ay/al*rr)); ends.append((x+bx/bl*rr,y+by/bl*rr))
    out=[]
    for i,(x,y) in enumerate(ps):
        sx,sy=starts[i]; ex,ey=ends[i]
        if not out: out.append((sx,sy))
        for k in range(1,steps+1):
            t=k/steps; out.append(((1-t)**2*sx+2*(1-t)*t*x+t*t*ex,(1-t)**2*sy+2*(1-t)*t*y+t*t*ey))
        ns=starts[(i+1)%n]
        if math.hypot(out[-1][0]-ns[0],out[-1][1]-ns[1])>1e-9: out.append(ns)
    if math.hypot(out[0][0]-out[-1][0],out[0][1]-out[-1][1])<1e-9: out.pop()
    return out
def intersect(a,bp,c,d):
    ax,ay=a; bx,by=bp; cx,cy=c; dx,dy=d; rx,ry=bx-ax,by-ay; sx,sy=dx-cx,dy-cy; den=rx*sy-ry*sx
    if abs(den)<1e-12:return None
    qx,qy=cx-ax,cy-ay; t=(qx*sy-qy*sx)/den; u=(qx*ry-qy*rx)/den
    return ((ax+t*rx,ay+t*ry),t) if -1e-9<=t<=1+1e-9 and -1e-9<=u<=1+1e-9 else None
def hit(boundary,a,bp):
    h=[]
    for i in range(len(boundary)):
        r=intersect(boundary[i],boundary[(i+1)%len(boundary)],a,bp)
        if r:h.append((i,r[1],r[0]))
    if len(h)!=1: raise RuntimeError(f'expected one wedge/boundary hit, got {len(h)}')
    return h[0]
def traverse(boundary,start,end,direction):
    n=len(boundary); si,_,sp=start; ei,_,ep=end; pts=[sp]
    if direction==1:
        i=(si+1)%n; stop=(ei+1)%n
        while i!=stop: pts.append(boundary[i]); i=(i+1)%n
    else:
        i=si
        while i!=ei: pts.append(boundary[i]); i=(i-1)%n
    pts.append(ep); return pts
def cut_c():
    ob=rounded(outer,g['outer_octagon']['corner_radius']*S); ib=rounded(inner,g['inner_octagon']['corner_radius']*S); apex,up,lo=tri
    ou,ol,iu,il=hit(ob,apex,up),hit(ob,apex,lo),hit(ib,apex,up),hit(ib,apex,lo)
    pts=traverse(ob,ou,ol,-1); pts.append(il[2]); pts.extend(traverse(ib,il,iu,1)[1:]); return sub(pts)

pos={}; cursor=SYM_W+wm['tracking']['symbol_as_c_to_h']
for ch in 'hamber': pos[ch]=cursor; cursor+=wm['widths'][ch]+(0 if ch=='r' else wm['tracking']['lowercase_pairs'])
WORD_W=pos['r']+R_W

def h(x): return sub([(x,ASC),(x+T,ASC),(x+T,TOP),(x+W,TOP),(x+W,BASE),(x+W-T,BASE),(x+W-T,TOP+T),(x+T,TOP+T),(x+T,BASE),(x,BASE)])
def a(x):
    left=T; right=A_W-T; top=TOP+T; bottom=BASE-T
    o=[(0,TOP+OCH),(OCH,TOP),(A_W,TOP),(A_W,BASE),(0,BASE)]; c=[(left,top+ICH),(left+ICH,top),(right,top),(right,bottom-ICH),(right-ICH,bottom),(left,bottom)]
    q=right+bottom-ICH+D; nl=q-BASE; nr=A_W; half=(nr-nl)/2; notch=[(nl,BASE),((nl+nr)/2,BASE-half),(nr,BASE)]
    return ' '.join(sub([(x+px,py) for px,py in ps]) for ps in (o,c,notch))
def m(x):
    s2=x+W-T; s3=x+M_W-T
    return sub([(x,TOP),(x+M_W,TOP),(x+M_W,BASE),(s3,BASE),(s3,TOP+T),(x+W,TOP+T),(x+W,BASE),(s2,BASE),(s2,TOP+T),(x+T,TOP+T),(x+T,BASE),(x,BASE)])
def bb(x): return sub([(x,ASC),(x+T,ASC),(x+T,TOP),(x+W,TOP),(x+W,BASE),(x,BASE)])+' '+sub([(x+T,TOP+T),(x+W-T,TOP+T),(x+W-T,BASE-T),(x+T,BASE-T)])
def e(x):
    mt=TOP+(wm['metrics']['x_height']-T)/2
    return sub([(x,TOP),(x+W,TOP),(x+W,mt+T),(x+T,mt+T),(x+T,BASE-T),(x+W,BASE-T),(x+W,BASE),(x,BASE),(x,mt),(x+W-T,mt),(x+W-T,TOP+T),(x+T,TOP+T),(x+T,mt),(x,mt)])
def r(x):
    rh=wm['r']['horizontal_component']; rv=wm['r']['vertical_component']; ux=R_W-rh; cu=ux+TOP; cl=cu+D; us=cu-T; ls=cl-T
    assert abs(rh-rv)<1e-9 and abs(rh+rv-D)<1e-9 and abs(us-wm['r']['upper_split_y'])<1e-9
    return sub([(x,TOP),(x+T,TOP),(x+T,us),(x+ux,TOP),(x+R_W,TOP),(x+R_W,TOP+rv),(x+T,ls),(x+T,BASE),(x,BASE)])
LOWER=' '.join((h(pos['h']),a(pos['a']),m(pos['m']),bb(pos['b']),e(pos['e']),r(pos['r']))); MAIN=cut_c()+' '+LOWER

def gradients(prefix):
    z=[]; profile=SPEC['wordmark_aurora']['radial_stop_profile']
    for i,x in enumerate(SPEC['wordmark_aurora']['hotspots']):
        cx=x['cx_ratio']*WORD_W; cy=x['cy_ratio']*H; rr=x['r_width_ratio']*WORD_W; peak=x['peak_opacity']; color=pal[x['color']]
        z.append(f'<radialGradient id="{prefix}m{i}" gradientUnits="userSpaceOnUse" cx="{cx:.3f}" cy="{cy:.3f}" r="{rr:.3f}"><stop offset="0%" stop-color="{color}" stop-opacity="{peak}"/><stop offset="62%" stop-color="{color}" stop-opacity="{peak*profile[1]["opacity_multiplier"]:.3f}"/><stop offset="100%" stop-color="{color}" stop-opacity="0"/></radialGradient>')
    for i,x in enumerate(SPEC['aurora']['wedge_field']):
        color=pal[x['color']]; peak=x['peak_opacity']; cx=x['cx']*S; cy=x['cy']*S+Y0; rr=x['r']*S
        z.append(f'<radialGradient id="{prefix}w{i}" gradientUnits="userSpaceOnUse" cx="{cx:.3f}" cy="{cy:.3f}" r="{rr:.3f}"><stop offset="0%" stop-color="{color}" stop-opacity="{peak}"/><stop offset="56%" stop-color="{color}" stop-opacity="{peak*.42:.3f}"/><stop offset="100%" stop-color="{color}" stop-opacity="0"/></radialGradient>')
    return ''.join(z)
def wedge(prefix): return f'<use href="#{prefix}wedge" fill="{pal[sa["wedge_base"]]}"/>'+''.join(f'<use href="#{prefix}wedge" fill="url(#{prefix}w{i})"/>' for i in range(len(SPEC['aurora']['wedge_field'])))
def color(prefix='wm'):
    defs=gradients(prefix)+f'<clipPath id="{prefix}clip"><path d="{outer_path}"/></clipPath><path id="{prefix}main" d="{MAIN}" fill-rule="evenodd"/><polygon id="{prefix}wedge" points="{tri_str}" clip-path="url(#{prefix}clip)"/>'
    main=f'<use href="#{prefix}main" fill="{pal["wordmark_base"]}"/>'+''.join(f'<use href="#{prefix}main" fill="url(#{prefix}m{i})"/>' for i in range(len(SPEC['wordmark_aurora']['hotspots'])))
    wp=wedge(prefix); blend=f'<g opacity="{sa["blend_underlayer_opacity"]:.2f}" style="mix-blend-mode:{sa["blend_mode"]}">{wp}</g>'; normal=f'<g opacity="{sa["normal_layer_opacity"]:.2f}">{wp}</g>'
    return f'<defs>{defs}</defs>{main}{blend}{normal}'
def mono(fill,prefix='wmm'):
    return f'<defs><clipPath id="{prefix}clip"><path d="{outer_path}"/></clipPath><path id="{prefix}main" d="{MAIN}" fill-rule="evenodd"/><polygon id="{prefix}wedge" points="{tri_str}" clip-path="url(#{prefix}clip)"/></defs><use href="#{prefix}main" fill="{fill}"/><use href="#{prefix}wedge" fill="{fill}" opacity="0.55"/>'
def svg(fill=None):
    title='Chamber wordmark' if fill is None else 'Chamber monochrome wordmark'; desc='Symbol-as-C Chamber wordmark with a continuous aurora field across the cut-C frame and hamber, plus a translucent independently arranged wedge.' if fill is None else 'Monochrome symbol-as-C Chamber wordmark for constrained reproduction.'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-18 14 {WORD_W+36:.3f} 244" role="img" aria-labelledby="title desc"><title id="title">{title}</title><desc id="desc">{desc}</desc>{color() if fill is None else mono(fill)}</svg>\n'
def preview(bg): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 480"><rect width="1280" height="480" rx="32" fill="{bg}"/><image href="../chamber-wordmark.svg" x="80" y="135" width="1120" height="210" preserveAspectRatio="xMidYMid meet"/></svg>\n'

(OUT/'chamber-wordmark.svg').write_text(svg(),encoding='utf-8'); (OUT/'chamber-wordmark-monochrome-dark.svg').write_text(svg(pal['monochrome_dark']),encoding='utf-8'); (OUT/'chamber-wordmark-monochrome-light.svg').write_text(svg(pal['monochrome_light']),encoding='utf-8')
(PREVIEWS/'chamber-on-light.svg').write_text(preview('#FFFFFF'),encoding='utf-8'); (PREVIEWS/'chamber-on-dark.svg').write_text(preview(pal['dark_background']),encoding='utf-8')
for legacy in ('chamber-lockup-horizontal.svg','chamber-lockup-horizontal-monochrome-dark.svg','chamber-lockup-horizontal-monochrome-light.svg'):
    p=OUT/legacy
    if p.exists(): p.unlink()
print('Generated Chamber symbol-as-C wordmark assets.')
