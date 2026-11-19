import { MODELS, sceneById, tileById } from './mockData';
import type { ChangeCandidate } from './types';
import type { ProvenanceNode } from '../components/charts/ProvenanceTree';

export function buildProvenanceTree(candidate: ChangeCandidate): ProvenanceNode {
  const tileBefore = tileById(candidate.tileBeforeId);
  const tileAfter = tileById(candidate.tileAfterId);
  const sceneBefore = tileBefore ? sceneById(tileBefore.sceneId) : undefined;
  const sceneAfter = tileAfter ? sceneById(tileAfter.sceneId) : undefined;
  const modelByName = (name: string) => MODELS.find((m) => m.name === name);

  return {
    id: 'root',
    label: `Candidate ${candidate.id}`,
    meta: candidate.type,
    defaultOpen: true,
    children: [
      {
        id: 'sources',
        label: 'Source scenes',
        defaultOpen: true,
        children: [
          {
            id: 'scene-before',
            label: `${sceneBefore?.sensor ?? '—'} · ${sceneBefore?.datetime ?? '—'}`,
            meta: sceneBefore?.checksum,
            children: [
              { id: 'sb-crs', label: `CRS ${sceneBefore?.crs}` },
              { id: 'sb-level', label: `Product level ${sceneBefore?.productLevel}` },
              { id: 'sb-licence', label: sceneBefore?.licence ?? '' },
            ],
          },
          {
            id: 'scene-after',
            label: `${sceneAfter?.sensor ?? '—'} · ${sceneAfter?.datetime ?? '—'}`,
            meta: sceneAfter?.checksum,
            children: [
              { id: 'sa-crs', label: `CRS ${sceneAfter?.crs}` },
              { id: 'sa-level', label: `Product level ${sceneAfter?.productLevel}` },
              { id: 'sa-licence', label: sceneAfter?.licence ?? '' },
            ],
          },
        ],
      },
      {
        id: 'processing',
        label: 'Processing chain',
        defaultOpen: true,
        children: [
          { id: 'mask', label: 'Cloud / shadow / snow masking', meta: modelByName('s2cloudless')?.version },
          { id: 'norm', label: 'IR-MAD radiometric normalisation', meta: `residual z ${candidate.seasonalZScore}` },
          { id: 'reg', label: 'Phase-correlation co-registration', meta: `${candidate.registrationResidualPx}px residual` },
          { id: 'tile', label: 'Tiling 256px / stride 128', meta: '10 m GSD' },
          { id: 'embed', label: 'Embedding', children: [
            { id: 'embed-clip', label: 'RemoteCLIP', meta: modelByName('RemoteCLIP')?.version },
            { id: 'embed-dino', label: 'DINOv2', meta: modelByName('DINOv2')?.version },
          ] },
          { id: 'change-model', label: 'Bi-temporal change confirmation', meta: modelByName('TinyCD')?.version },
          { id: 'sar', label: 'Sentinel-1 cross-check', meta: `agreement ${Math.round(candidate.sarAgreement * 100)}%` },
          { id: 'calib', label: 'Confidence calibration', meta: 'logistic regression, 7 factors' },
        ],
      },
      {
        id: 'model-versions',
        label: 'Model registry snapshot',
        children: MODELS.map((m) => ({
          id: `model-${m.name}`,
          label: `${m.name} ${m.version}`,
          meta: m.sha256.slice(0, 12),
        })),
      },
    ],
  };
}
