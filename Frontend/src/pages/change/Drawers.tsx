import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ShieldX } from 'lucide-react';
import { tileById } from '../../lib/mockData';
import { TileThumb } from '../../components/ui/TileThumb';
import { Badge } from '../../components/ui/Badge';
import { Drawer } from '../../components/ui/Drawer';
import type { ChangeCandidate, SuppressionGateId } from '../../lib/types';
import { GATE_INFO, yearOf } from './changeHelpers';

export function GalleryDrawer({ open, onClose, title, blurb, gates, candidates }: {
  open: boolean; onClose: () => void; title: string; blurb: string; gates: SuppressionGateId[]; candidates: ChangeCandidate[];
}) {
  return (
    <Drawer open={open} onClose={onClose} title={title} subtitle="Candidates the system chose NOT to report" width="w-[560px]">
      <div className="p-4 space-y-5">
        <p className="text-xs text-text-secondary leading-relaxed">{blurb}</p>
        {gates.map((g) => {
          const items = candidates.filter((c) => c.suppressedBy === g);
          return (
            <section key={g}>
              <div className="flex items-center gap-2 mb-1">
                <ShieldX size={13} className="text-status-bad" />
                <h4 className="text-xs font-semibold text-text-primary">{GATE_INFO[g].label} gate</h4>
                <span className="mono text-[10px] text-text-faint">{items.length} sampled</span>
              </div>
              <p className="text-[11px] text-text-muted mb-2 leading-snug">{GATE_INFO[g].explain}</p>
              {items.length === 0 ? (
                <div className="text-[11px] text-text-faint border border-dashed border-border rounded-md p-3">No sampled candidates were removed by this gate.</div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2">
                  {items.map((c, i) => {
                    const tb = tileById(c.tileBeforeId);
                    const ta = tileById(c.tileAfterId);
                    return (
                      <motion.div
                        key={c.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="bg-bg-raised border border-border-subtle rounded-lg p-2.5"
                      >
                        <div className="flex gap-1.5 mb-2">
                          {tb && <TileThumb tile={tb} size={52} />}
                          {ta && <TileThumb tile={ta} size={52} />}
                          <div className="ml-auto text-right">
                            <div className="mono text-[10px] text-text-faint">{yearOf(c.earliestIntervalStart)}→{yearOf(c.earliestIntervalEnd)}</div>
                            <div className="mono text-[11px] text-status-bad">{Math.round(c.confidence * 100)}%</div>
                          </div>
                        </div>
                        <div className="text-[11px] font-medium text-text-primary">{c.headline?.replace(' (suppressed)', '')}</div>
                        <p className="text-[10px] text-text-muted mt-1 leading-snug">{c.narrative}</p>
                        <div className="mt-2"><Badge color="var(--color-status-bad)">{c.rejectReason}</Badge></div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </Drawer>
  );
}

function H({ children }: { children: ReactNode }) {
  return <div className="text-[11px] font-semibold text-text-primary mb-1">{children}</div>;
}

export function HelpDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer open={open} onClose={onClose} title="How change analysis works" subtitle="From two photographs to a short, trustworthy list" width="w-[540px]">
      <div className="p-4 space-y-4 text-[12px] text-text-secondary leading-relaxed">
        <div><H>The idea</H>Compare two frames of the same place and report only the differences that are real, lasting and meaningful — not clouds, shadows, seasons or misalignment.</div>
        <div><H>1 · Time window</H>Auto uses the whole decade. Pick two years to focus on one chapter. Findings shown are the ones that first appear inside your window.</div>
        <div><H>2 · Change types</H>Construction, clearance, water extent and road development each have a fixed colour used everywhere in the app. Airstrips count as road development because they are long, narrow new surfaces.</div>
        <div><H>3 · Precision ↔ recall</H>Precision means "when it reports something, it is right". Recall means "it misses little". You cannot maximise both, so the slider moves the confidence cut-off and the two meters show the expected result from held-out testing. This system leans to precision by default.</div>
        <div><H>4 · Run</H>Five stages run in order: mask bad pixels, normalise brightness, align the frames, score every tile pair, then filter through seven gates.</div>
        <div><H>Reading the picture</H>Numbered boxes on the image match the numbered cards on the right. Hover either to highlight the other. Click a finding to zoom straight to it and see the evidence behind it.</div>
        <div><H>Compare tools</H><b className="text-text-primary">Swipe</b> drag the divider. <b className="text-text-primary">Blink</b> flips between years. <b className="text-text-primary">Fade</b> cross-dissolves. <b className="text-text-primary">Side by side</b> shows both at once.</div>
        <div>
          <H>The seven gates</H>
          <ul className="space-y-1.5 mt-1">
            {Object.values(GATE_INFO).map((g) => (
              <li key={g.label}><span className="text-text-primary font-medium">{g.label}.</span> <span className="text-text-muted">{g.explain}</span></li>
            ))}
          </ul>
        </div>
        <div>
          <H>Keyboard</H>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            {[['R', 'run analysis'], ['1–4', 'switch compare tool'], ['← →', 'move the divider'], ['J / K', 'next / previous finding'], ['Esc', 'clear selection'], ['?', 'all shortcuts']].map(([k, d]) => (
              <div key={k} className="flex items-center justify-between gap-2"><span className="text-text-muted">{d}</span><kbd className="mono px-1.5 py-0.5 rounded bg-bg-raised border border-border text-text-primary">{k}</kbd></div>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
