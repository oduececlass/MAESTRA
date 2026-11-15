"""Add the shared MAESTRA design layer (and embed sizing) to every learning page.

Run from anywhere:   python tools/apply_shared_design.py
Safe to run again (e.g. after copying updated MESFET pages in): it only adds what is missing.
"""
import pathlib, re, posixpath

ROOT = pathlib.Path(__file__).resolve().parent.parent
# page file -> (page id, is a chapter/reading page, include embed sizing script)
PAGES = {
    'modules/1_Semiconductor_Basics/1.1_Basic_Semiconductor.html':                ('basic', True, True),
    'modules/1_Semiconductor_Basics/1.2_Fermi_DOS_Concentration_Simulator.html': ('fermi', False, True),
    'modules/2_PN_Diode/2.1_PN_Diode_Chapter.html':                               ('pn', True, True),
    'modules/2_PN_Diode/2.2_PN_Diode_Drift_Diffusion_Simulator.html':             ('drift', False, True),
    'modules/2_PN_Diode/2.3_Poisson_Rubber_Sheet.html':                           ('poisson', False, True),
    'modules/2_PN_Diode/2.4_Poisson_Rubber_Sheet_AI_HighRes.html':                ('poisson-ai', False, True),
    'modules/3_BJT/3.1_Bipolar_Transistors.html':                                 ('bjt', True, True),
    'modules/3_BJT/3.2_BJT_Metaphor.html':                                        ('bjt-metaphor', False, True),
    'modules/4_MOSFET/4.1_MOS_Capacitor_and_MOSFET.html':                         ('mos', True, True),
    'modules/4_MOSFET/4.2_MOS_Water_Table_Metaphor.html':                         ('mos-water', False, True),
    'modules/4_MOSFET/4.3_MOS_Surface_Potential.html':                            ('mos-surface', False, True),
    'modules/4_MOSFET/4.4_MOS_CV_Frequency.html':                                 ('mos-cv', False, True),
    'modules/4_MOSFET/4.5_nMOS_Device_Lab.html':                                  ('nmos', False, True),
    'modules/5_MESFET/5.3_Schottky_Thermionic_Emission.html':              ('mesfet-01', False, False),
    'modules/5_MESFET/5.2_Metal_Semiconductor_Contact_Lab.html':          ('mesfet-02', False, False),
    'modules/5_MESFET/5.4_Schottky_Contact_Simulator.html':                ('mesfet-03', False, False),
    'modules/5_MESFET/5.5_Frozen_Sluice_Lab.html':                         ('mesfet-04', False, False),
    'modules/5_MESFET/5.6_MESFET_2D_Dynamic_Channel.html':                 ('mesfet-05', False, False),
    'modules/5_MESFET/5.1_MESFET_Chapter.html':                     ('mesfet-tutor', True, False),
    'modules/6_Solar_Cells/6.1_Solar_Cells_Chapter.html':                                           ('solar', True, True),
    'modules/6_Solar_Cells/6.2_Photovoltaic_Waterworks_Simulator.html':                ('solar-loop', False, True),
}
MARK = '<!-- maestra-design-v1 -->'
AI_MARK = '<!-- maestra-ai-v1 -->'
# one AI tutor per chapter (reading pages); the title is what the tutor and its chat history show
CHAPTERS = {'basic': ('t1', '1. Semiconductor Basics'), 'pn': ('t2', '2. PN Diode'), 'bjt': ('t3', '3. Bipolar Junction Transistors'),
            'mos': ('t4', '4. MOS Capacitor & MOSFET'), 'mesfet-tutor': ('t5', '5. MESFET'), 'solar': ('t6', '6. Solar Cells')}

def main():
    for rel, (pid, reading, embed) in PAGES.items():
        p = ROOT / rel
        if not p.exists():
            print('missing', rel); continue
        t = open(p, encoding='utf-8', errors='surrogateescape', newline='').read()
        orig = t
        m = re.search(r'<html\b[^>]*>', t, re.I)
        tag = m.group(0)
        new = re.sub(r'\sdata-maestra-(page|reading)(="[^"]*")?', '', tag)
        new = new[:-1].rstrip('/') + f' data-maestra-page="{pid}"' + (' data-maestra-reading' if reading else '') + '>'
        t = t[:m.start()] + new + t[m.end():]
        if MARK not in t:
            up = posixpath.relpath('shared', posixpath.dirname(rel))
            block = f'\n{MARK}\n<link rel="stylesheet" href="{up}/maestra-design.css">\n'
            if embed: block += f'<script defer src="{up}/maestra-embed.js"></script>\n'
            i = t.lower().rfind('</body>')
            t = t[:i] + block + t[i:]
        if pid in CHAPTERS and AI_MARK not in t:
            up = posixpath.relpath('shared', posixpath.dirname(rel))
            cid, ctitle = CHAPTERS[pid]
            block = (f'\n{AI_MARK}\n<link rel="stylesheet" href="{up}/maestra-ai.css">\n'
                     f'<script defer src="{up}/maestra-ai.js" data-chapter="{cid}" data-chapter-title="{ctitle}"></script>\n')
            i = t.lower().rfind('</body>')
            t = t[:i] + block + t[i:]
        if t != orig:
            open(p, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(t)
            print('updated', rel)
        else:
            print('ok     ', rel)

if __name__ == '__main__':
    main()
