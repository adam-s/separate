export type Label = 'speech' | 'music' | 'target' | 'silence';

export interface Frame {
  tSec: number;
  rms: number;
  flatness: number;
  ast: { speech: number; music: number; target: number };
  label: Label;
}

export interface Span {
  startSec: number;
  endSec: number;
  label: Label;
  classId?: number;
  kept: boolean;
}

export interface StemChunk {
  stemStart: number;
  stemEnd: number;
  origStart: number;
  origEnd: number;
}

export interface Stem {
  label: Label;
  classId: number;
  audioUrl: string;
  durationSec: number;
  chunks: StemChunk[];
}

export interface ClipData {
  clip: string;
  durationSec: number;
  sampleRate: number;
  audioUrl?: string;
  waveformPeaks: [number, number][];
  melSpectrogram: { nMels: number; hop: number; frames: number[][] };
  frames: Frame[];
  spans: Span[];
  stems?: Stem[];
}

export const LABEL_COLORS: Record<Label, string> = {
  speech: '#9a9a9a',
  music: '#c8a23e',
  target: '#2a7a4a',
  silence: '#d8d2c4',
};

export const LABEL_TITLES: Record<Label, string> = {
  speech: 'Speech',
  music: 'Music',
  target: 'Target',
  silence: 'Silence',
};

export async function loadClip(name: string): Promise<ClipData> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${name}.json`);
  if (!res.ok) throw new Error(`Failed to load clip ${name}: ${res.status}`);
  return res.json();
}

export interface ClipInfo {
  slug: string;
  title: string;
  source: string;
  url: string;
  durationSec: number;
  mix: { speech: number; music: number; target: number };
}

export async function loadClips(): Promise<ClipInfo[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/clips.json`);
  if (!res.ok) throw new Error(`Failed to load clip index: ${res.status}`);
  return res.json();
}
